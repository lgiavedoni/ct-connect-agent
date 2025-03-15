import { Request, Response } from 'express';
import { logger } from '../utils/logger.utils';
import { aiRunPrompt, aiRunPromptWithUserPrompt, model_flash_thinking, model_openai_gpt_4_o, model_openai_o3_mini, aiRunPromptStream } from '../client/ai.client';
import { Message } from 'ai';
import graphqlClient from '../client/graphqlExecution.client'; 
import CustomError from '../errors/custom.error';
import { generateGraphQLQuery } from '../tools/graphqlGeneration.tool';
import { executeGraphQLQuery } from '../tools/graphqlExecutor.tool';
import { cleanJson } from '../utils/json.utils';

// In-memory storage to track request processing state
interface ChunkData {
  id: number;
  type: string;
  text?: string;
  response?: any;
  timestamp: number;
}

interface RequestState {
  chunks: ChunkData[];
  isComplete: boolean;
  finalResponse: any | null;
  lastUpdated: number;
}

// Simple in-memory cache - in production, consider using Redis or another more robust solution
class ResponseStorage {
  private static requests = new Map<string, RequestState>();
  private static cleanupInterval: NodeJS.Timeout;
  
  static init() {
    // Cleanup old requests every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 3600000);
  }
  
  static cleanup() {
    const now = Date.now();
    const expireThreshold = 3600000; // 1 hour
    
    for (const [requestId, state] of this.requests.entries()) {
      if (now - state.lastUpdated > expireThreshold) {
        this.requests.delete(requestId);
      }
    }
  }
  
  static createRequest(requestId: string): void {
    this.requests.set(requestId, {
      chunks: [],
      isComplete: false,
      finalResponse: null,
      lastUpdated: Date.now()
    });
  }
  
  static addChunk(requestId: string, chunk: Omit<ChunkData, 'id' | 'timestamp'>): void {
    const state = this.requests.get(requestId);
    if (!state) return;
    
    const newChunk: ChunkData = {
      ...chunk,
      id: state.chunks.length,
      timestamp: Date.now()
    };
    
    // Log chunk addition with content preview
    if (chunk.type === 'chunk' && chunk.text) {
      const preview = chunk.text.length > 30 ? 
        `${chunk.text.substring(0, 30)}...` : chunk.text;
      logger.debug(`Adding chunk ${newChunk.id} to request ${requestId}: ${preview}`);
    } else {
      logger.debug(`Adding ${chunk.type} chunk ${newChunk.id} to request ${requestId}`);
    }
    
    state.chunks.push(newChunk);
    state.lastUpdated = Date.now();
    
    // If this is a 'complete' chunk, mark the request as complete
    if (chunk.type === 'complete' && chunk.response) {
      state.isComplete = true;
      state.finalResponse = chunk.response;
      logger.info(`Request ${requestId} marked as complete after ${state.chunks.length} chunks`);
    }
  }
  
  static getChunksSince(requestId: string, sinceId: number): ChunkData[] {
    const state = this.requests.get(requestId);
    if (!state) return [];
    
    const newChunks = state.chunks.filter(chunk => chunk.id > sinceId);
    
    logger.debug(`Retrieved ${newChunks.length} chunks since ID ${sinceId} for request ${requestId}`);
    
    // Log details about the chunks being sent
    if (newChunks.length > 0) {
      const firstChunkId = newChunks[0]?.id;
      const lastChunkId = newChunks[newChunks.length - 1]?.id;
      logger.debug(`Sending chunks ${firstChunkId} to ${lastChunkId} for request ${requestId}`);
    }
    
    return newChunks;
  }
  
  static isComplete(requestId: string): boolean {
    return this.requests.get(requestId)?.isComplete || false;
  }
  
  static getFinalResponse(requestId: string): any | null {
    return this.requests.get(requestId)?.finalResponse || null;
  }
  
  static deleteRequest(requestId: string): void {
    this.requests.delete(requestId);
  }
}

// Initialize the storage
ResponseStorage.init();

// import {
//   HTTP_STATUS_RESOURCE_NOT_FOUND,
//   HTTP_STATUS_SUCCESS_ACCEPTED,
//   HTTP_STATUS_BAD_REQUEST,
//   HTTP_STATUS_SUCCESS_NO_CONTENT,
// } from '../constants/http.status.constants';

interface AgentRequest extends Request {
  body: {
    messages: Message[];
    requestId?: string;
    [key: string]: unknown;
  };
}

const systemPrompt: string = `

    <goal>
    You are a helpful  assistant that manages a commercetools store.
    Your goal is to answer the user's request and ALWAYS try your best, even it takes multiple steps.
    IMPORTANT, do not tell me how you might or could do it. Just do it. The user wants the answer, not how you will get there.
    ***Try as much as possible avoid asking unneeded questions to the user. And make decisions based on the information provided by the user.***
    If you have a viable plan go and execute it, don't ask the user for confirmation.

    </goal>

    <tools>
    You are the main orchestator and will have at your disposal a number of tools to help you answer the user's request.
    ***IMPORTANT, use your tools to answer the user's request. Don't just do it yourself.***
    *** NEVER alucinate with data, or make up data.***
    </tools>

    <rules>
      NEVER try to execute a GraphQL query directly without first generating it with the generateGraphQLQuery tool.
      ***NEVER try to create a GraphQL query yourself - always use the generateGraphQLQuery tool.***
      If you need te generate and execute several GraphQL queries to solve the user's request that is ok.
      When there is an error with the GraphQL query, you will need to fix it by using the generateGraphQLQuery tool again and providing the error message.
      
      *** Critical, if you are going to update/delete/create an entity (basically any mutation) , you first have to ask user for confirmation providing useful information about the entity. And ALWAYS provide the entity's id and also include the hashtag (#CONFIRMATION_NEEDED) in the message.***

      ALLWAYS return a valid JSON object following the return_format below.
    </rules>
    <context>
      Today is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </context>


    <return_format>
      *****ALLWAYS Return a JSON object.*****
      The JSON should be in the following format (do NOT include anything else before or after the JSON object):
        {
          "answer": "The answer to the user's request. Give him the answer, not how you got it.
                    The user is a human, so your response should be in a natural language and easy to understand.
                    ALWAYS use markdown formatting to make your response more readable.",
          "graphql_queries": [ // This is an array of the queies generated by the generateGraphQLQuery tool. ONLY by the tool
                    {
                      "query": "The generated GraphQL query by the generateGraphQLQuery tool that where successfully executed",
                      "query_type": "The type of the query that was executed. Example: Read, Write",
                    }
                  ],
          "entities": [
                    {
                      "entity_type": "The type of the entity that has been involved in this oporation. Example: Products, Orders..",
                    }
                  ]
          
        }
        Even if you have not executed any GraphQL queries or something went wrong, you should return the return_format.
    </return_format>
`;
        // "graphql_query": [
        //         {
        //           "query": "The generated GraphQL query by the generateGraphQLQuery tool that where successfully executed",
        //           "query_type": "The type of the query that was executed. Example: Read, Write",
        //         }
        //       ],
        //       "entities": [
        //         {
        //           "entity_type": "The type of the entity that has been involved in this oporation. Example: Products, Orders..",
        //         }
        //       ]

/**
 * Start processing a request but return immediately.
 * This allows the client to begin polling for updates.
 */
export const startAgentHandler = async (request: AgentRequest, response: Response): Promise<void> => {
  try {
    const { messages, requestId } = request.body;
    
    if (!requestId) {
      throw new CustomError(400, 'Bad request: requestId is required', undefined);
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new CustomError(400, 'Bad request: messages array is required', undefined);
    }
    
    // Validate and sanitize messages
    const sanitizedMessages = messages.map(msg => {
      // Check for single character content that might cause issues
      if (typeof msg.content === 'string' && msg.content.length === 1 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(msg.content)) {
        logger.info(`Sanitizing single special character message: ${msg.content}`);
        return {
          ...msg,
          content: `${msg.content} ` // Add a space to prevent issues
        };
      }
      return msg;
    });
    
    logger.info(`Starting request processing for ${requestId} with ${sanitizedMessages.length} messages`);
    
    // Initialize request in storage
    ResponseStorage.createRequest(requestId);
    
    // Start processing in the background with sanitized messages
    processAgentRequest(requestId, sanitizedMessages)
      .catch(err => {
        logger.error(`Error processing request ${requestId}: ${err}`);
        ResponseStorage.addChunk(requestId, {
          type: 'error',
          text: String(err)
        });
      });
    
    // Return success immediately
    response.status(202).json({
      status: 'processing',
      requestId
    });
  } catch (err: unknown) {
    logger.error(err);
    
    if (err instanceof CustomError) {
      response.status(Number(err.statusCode)).send(err);
    } else if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      response.status(Number((err as { statusCode: number | string }).statusCode)).send(err);
    } else {
      response.status(500).send(err);
    }
  }
};

/**
 * Get streaming chunks for a request since a specific chunk ID
 */
export const getStreamChunks = async (request: Request, response: Response): Promise<void> => {
  try {
    const { requestId } = request.params;
    // Check for 'since' in both query and body to be more flexible
    const sinceId = parseInt(
      (request.query.since as string) || 
      (request.body?.since as string) || 
      '0'
    );
    
    if (!requestId) {
      throw new CustomError(400, 'Bad request: requestId is required', undefined);
    }
    
    logger.info(`Getting stream chunks for request ${requestId} since chunk ${sinceId}`);
    
    // Check if the request is already complete
    const isComplete = ResponseStorage.isComplete(requestId);
    const finalResponse = isComplete ? ResponseStorage.getFinalResponse(requestId) : null;
    
    // If request is complete, we can optimize the response
    if (isComplete) {
      if (sinceId === 0) {
        // For the first request, return just the final result with no intermediate chunks
        logger.info(`Request ${requestId} is already complete, returning final response directly`);
        
        response.json({
          chunks: [{
            id: 1,
            type: 'chunk',
            text: finalResponse?.answer || '',
            timestamp: Date.now()
          }],
          isComplete: true,
          finalResponse,
          stopPolling: true // Signal to frontend to stop polling
        });
        return;
      } else {
        // For subsequent requests, return all remaining chunks in one go
        const chunks = ResponseStorage.getChunksSince(requestId, sinceId);
        
        // If there are no new chunks but we're complete, still return the final response
        // and signal to stop polling
        response.json({
          chunks: chunks.length > 0 ? chunks : [],
          isComplete: true,
          finalResponse,
          stopPolling: true // Signal to frontend to stop polling
        });
        return;
      }
    }
    
    // For incomplete requests, return chunks as normal
    const chunks = ResponseStorage.getChunksSince(requestId, sinceId);
    
    response.json({
      chunks,
      isComplete,
      finalResponse
    });
  } catch (err: unknown) {
    logger.error(err);
    
    if (err instanceof CustomError) {
      response.status(Number(err.statusCode)).send(err);
    } else if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      response.status(Number((err as { statusCode: number | string }).statusCode)).send(err);
    } else {
      response.status(500).send(err);
    }
  }
};

/**
 * Process the agent request in the background and store chunks
 */
async function processAgentRequest(requestId: string, messages: Message[]): Promise<void> {
  try {
    // Accumulated text for storing a consolidated response
    let accumulatedText = '';
    let lastChunkTime = Date.now();
    const CHUNK_INTERVAL_MS = 250; // Only store a chunk every 250ms - increased from 150ms
    let pendingChunkText = ''; // Buffer for pending text between intervals
    
    // Create a callback function to handle streaming chunks
    const streamHandler = (chunk: string) => {
      // Accumulate all text
      accumulatedText += chunk;
      pendingChunkText += chunk;
      
      // Only store individual chunks at reasonable intervals
      // This prevents flooding the storage with tiny chunks
      const now = Date.now();
      if (now - lastChunkTime > CHUNK_INTERVAL_MS && pendingChunkText.length > 0) {
        ResponseStorage.addChunk(requestId, {
          type: 'chunk',
          text: pendingChunkText // Store accumulated text since last chunk
        });
        pendingChunkText = ''; // Reset buffer
        lastChunkTime = now;
      }
    };
    
    // Run the AI processing with streaming
    const aiResponse = await aiRunPromptStream(
      systemPrompt,
      messages,
      [generateGraphQLQuery, executeGraphQLQuery],
      model_openai_gpt_4_o,
      streamHandler
    );

    logger.info(`AI Response completed for ${requestId} with ${aiResponse.fullText.length} characters`);
    
    // Add any remaining pending chunk text
    if (pendingChunkText.length > 0) {
      ResponseStorage.addChunk(requestId, {
        type: 'chunk',
        text: pendingChunkText
      });
    }
    
    // Try to parse the full response as JSON
    try {
      const jsonResponse = cleanJson(aiResponse.fullText);
      
      // Store the complete response
      ResponseStorage.addChunk(requestId, {
        type: 'complete',
        response: jsonResponse,
        // Also include the full text for immediate display
        text: aiResponse.fullText
      });
      
    } catch (error) {
      // If parsing fails, store the original text
      logger.warn(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : String(error)}`);
      ResponseStorage.addChunk(requestId, {
        type: 'complete',
        response: { answer: aiResponse.fullText },
        // Include the full text for immediate display
        text: aiResponse.fullText
      });
    }
  } catch (err: unknown) {
    logger.error(`Error in processAgentRequest for ${requestId}: ${err}`);
    ResponseStorage.addChunk(requestId, {
      type: 'error',
      text: String(err)
    });
  }
}

/**
 * Agent handler for processing chat messages and streaming responses
 * 
 * For testing in Postman:
 * 1. Set the request method to POST
 * 2. Set the URL to your endpoint
 * 3. In the Headers tab, add:
 *    - Content-Type: application/json
 *    - Accept: application/x-ndjson
 * 4. In the Body tab, select "raw" and "JSON", then add your messages array
 * 5. Send the request and you should see the streaming response in real-time
 * 
 * @param request The agent request containing messages
 * @param response The Express response object
 */
export const angetHandler = async (request: AgentRequest, response: Response): Promise<void> => {
  try {
    const { messages, requestId } = request.body;
    
    // If a requestId is provided, use the new streaming approach
    if (requestId) {
      return startAgentHandler(request, response);
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error('Missing or invalid messages array in request body.');
      throw new CustomError(
        400,
        'Bad request: messages array is required in request body',
        undefined
      );
    } else {
      logger.info(`Processing request, ${JSON.stringify(messages)}`);
    }

    // Validate and sanitize messages
    const sanitizedMessages = messages.map(msg => {
      // Check for single character content that might cause issues
      if (typeof msg.content === 'string' && msg.content.length === 1 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(msg.content)) {
        logger.info(`Sanitizing single special character message: ${msg.content}`);
        return {
          ...msg,
          content: `${msg.content} ` // Add a space to prevent issues
        };
      }
      return msg;
    });

    // Set appropriate headers for streaming
    response.setHeader('Content-Type', 'application/x-ndjson'); // Line-delimited JSON
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx
    
    logger.info(`Processing request with ${sanitizedMessages.length} messages`);
    
    // Send initial message
    response.write(JSON.stringify({ type: 'start', status: 'started' }) + '\n');
    
    // Try to flush the response if the method exists
    // Some Express configurations with compression middleware add this method
    if (typeof (response as any).flush === 'function') {
      (response as any).flush();
    }
    
    // Track when the last chunk was sent to avoid overwhelming the client
    let lastChunkTime = Date.now();
    const MIN_CHUNK_INTERVAL_MS = 50; // Minimum time between chunks
    
    // Create a callback function to handle streaming chunks
    const streamHandler = (chunk: string) => {
      // Ensure we don't send chunks too quickly
      const now = Date.now();
      const timeSinceLastChunk = now - lastChunkTime;
      
      if (timeSinceLastChunk < MIN_CHUNK_INTERVAL_MS) {
        // Small delay to ensure chunks aren't sent too quickly
        // This helps clients like Postman process the stream properly
        const delay = MIN_CHUNK_INTERVAL_MS - timeSinceLastChunk;
        setTimeout(() => {
          sendChunk(chunk);
        }, delay);
      } else {
        sendChunk(chunk);
      }
    };
    
    // Helper function to send a chunk and update the timestamp
    const sendChunk = (chunk: string) => {
      // Send each chunk as a separate line-delimited JSON object
      response.write(JSON.stringify({ type: 'chunk', text: chunk }) + '\n');
      
      // Force flush the response to ensure it's sent immediately
      if (typeof (response as any).flush === 'function') {
        (response as any).flush();
      }
      
      lastChunkTime = Date.now();
    };
    
    // Pass the streamHandler callback to aiRunPromptStream
    const aiResponse = await aiRunPromptStream(
      systemPrompt,
      sanitizedMessages, // Use sanitized messages
      [generateGraphQLQuery, executeGraphQLQuery],
      model_openai_gpt_4_o,
      streamHandler
    );

    logger.info(`AI Response completed with ${aiResponse.fullText.length} characters`);

    response.write(JSON.stringify({
        type: 'ai_response',
        response: aiResponse,
        completed: false
      }) + '\n');
    
    // Try to parse the full response as JSON
    try {
      const jsonResponse = cleanJson(aiResponse.fullText);
      
      // Send the complete response as a final JSON object
      response.write(JSON.stringify({
        type: 'complete',
        response: jsonResponse,
        completed: true
      }) + '\n');
      
    } catch (error) {
      // If parsing fails, return the original text
      logger.warn(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : String(error)}`);
      response.write(JSON.stringify({
        type: 'complete',
        response: { answer: aiResponse.fullText },
        error: "Failed to parse as JSON",
        completed: true
      }) + '\n');
    }
    
    // End the response stream
    response.end();
  } catch (err: unknown) {
    logger.error(err);
    console.log(err);
    
    // If headers haven't been sent yet, we can send an error response
    if (!response.headersSent) {
      if (err instanceof CustomError) {
        response.status(Number(err.statusCode)).send(err);
      } else if (typeof err === 'object' && err !== null && 'statusCode' in err) {
        response.status(Number((err as { statusCode: number | string }).statusCode)).send(err);
      } else {
        response.status(500).send(err);
      }
    } else {
      // If headers have been sent, we need to end the response with an error message
      response.write(JSON.stringify({
        type: 'error',
        error: String(err),
        completed: true
      }) + '\n');
      response.end();
    }
  }
};
