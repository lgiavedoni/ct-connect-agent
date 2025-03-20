/**
 * Chat response model
 * 
 * This file defines the structure of the response from the AI agent API
 */

export const QUERY_TYPES = {
  READ: 'Read',
  WRITE: 'Write',
};

export const ENTITY_TYPES = {
  PRODUCTS: 'Products',
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  CARTS: 'Carts',
  CATEGORIES: 'Categories',
  // Add more entity types as needed
};

export const TOOL_TYPES = {
  GRAPHQL_GENERATE: 'generateGraphQLQuery',
  GRAPHQL_EXECUTE: 'executeGraphQLQuery',
  // Add more tool types as needed
};

/**
 * @typedef {Object} GraphQLQuery
 * @property {string} query - The GraphQL query that was executed
 * @property {string} query_type - The type of query (Read/Write)
 */

/**
 * @typedef {Object} Entity
 * @property {string} entity_type - The type of entity involved in the operation
 */

/**
 * @typedef {Object} ToolCall
 * @property {string} type - The type of tool call
 * @property {string} toolCallId - The ID of the tool call
 * @property {string} toolName - The name of the tool
 * @property {Object} args - The arguments passed to the tool
 */

/**
 * @typedef {Object} ToolResult
 * @property {string} type - The type of tool result
 * @property {string} toolCallId - The ID of the tool call
 * @property {string} toolName - The name of the tool
 * @property {Object} args - The arguments passed to the tool
 * @property {Object} result - The result of the tool call
 */

/**
 * @typedef {Object} Step
 * @property {string} stepType - The type of step
 * @property {string} text - The text response
 * @property {Array<ToolCall>} toolCalls - The tool calls made in this step
 * @property {Array<ToolResult>} toolResults - The results of the tool calls
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} answer - The text response to the user's request
 * @property {GraphQLQuery[]} [graphql_queries] - Array of GraphQL queries executed
 * @property {Entity[]} [entities] - Array of entities involved in the operation
 * @property {Array<Step>} [steps] - Array of steps taken to generate the response
 */

/**
 * Parses a response that may contain multiple JSON lines
 * 
 * @param {string} responseText - Raw response text that may contain multiple JSON objects
 * @returns {Object} The extracted data or null
 */
export const parseResponseText = (responseText) => {
  console.log('Parsing response text:', responseText);
  
  if (!responseText || typeof responseText !== 'string') {
    console.log('Invalid response text');
    return null;
  }
  
  try {
    // Split by newlines and process each line
    const lines = responseText.split('\n').filter(line => line.trim());
    console.log('Response lines:', lines.length);
    
    // Look for the full_ai_response type first
    const fullAiResponseLine = lines.find(line => line.includes('"type":"full_ai_response"'));
    if (fullAiResponseLine) {
      try {
        console.log('Found full_ai_response line');
        const parsedData = JSON.parse(fullAiResponseLine);
        if (parsedData.type === 'full_ai_response' && parsedData.response) {
          console.log('Extracted full_ai_response data');
          
          // Check if stepsPromise is available
          if (parsedData.response.stepsPromise && 
              parsedData.response.stepsPromise.status &&
              parsedData.response.stepsPromise.status.type === 'resolved' &&
              parsedData.response.stepsPromise.status.value) {
            
            const steps = parsedData.response.stepsPromise.status.value;
            console.log('Extracted steps data:', steps.length);
            
            // Get the text from textPromise if available
            let answer = '';
            if (parsedData.response.textPromise && 
                parsedData.response.textPromise.status &&
                parsedData.response.textPromise.status.type === 'resolved') {
              answer = parsedData.response.textPromise.status.value;
            } else if (parsedData.response.fullText) {
              answer = parsedData.response.fullText;
            }
            
            return {
              answer,
              steps
            };
          }
          
          // Fallback to fullText if available
          if (parsedData.response.fullText) {
            return {
              answer: parsedData.response.fullText
            };
          }
        }
      } catch (e) {
        console.error('Error parsing full_ai_response line:', e);
      }
    }
    
    // Look for the complete response if no full_ai_response found
    const completeLine = lines.find(line => line.includes('"type":"complete"'));
    if (completeLine) {
      try {
        console.log('Found complete line:', completeLine);
        const parsedData = JSON.parse(completeLine);
        if (parsedData.type === 'complete' && parsedData.response) {
          console.log('Extracted complete response data:', parsedData.response);
          return parsedData.response;
        }
      } catch (e) {
        console.error('Error parsing complete line:', e);
      }
    }
    
    // If no complete response found, try to find any JSON object with an answer field
    for (const line of lines.reverse()) { // Check in reverse to get the last one first
      try {
        const parsedLine = JSON.parse(line);
        if (parsedLine.response && parsedLine.response.answer) {
          console.log('Found response with answer:', parsedLine.response);
          return parsedLine.response;
        } else if (parsedLine.answer) {
          console.log('Found direct answer:', parsedLine);
          return parsedLine;
        }
      } catch (e) {
        // Ignore parsing errors for individual lines
      }
    }
    
    // If we still haven't found anything, try to parse the entire response as one JSON
    try {
      const parsedFull = JSON.parse(responseText);
      if (parsedFull.answer || (parsedFull.response && parsedFull.response.answer)) {
        console.log('Parsed entire response:', parsedFull);
        return parsedFull.response || parsedFull;
      }
    } catch (e) {
      console.error('Error parsing full response:', e);
    }
    
    console.log('No valid response data found in text');
    return null;
  } catch (error) {
    console.error('Error processing response text:', error);
    return null;
  }
};

/**
 * Creates a message object from the API response
 * 
 * @param {Object|string} response - The response from the API
 * @returns {Object} A message object with the response content and metadata
 */
export const createMessageFromResponse = (response) => {
  console.log('Creating message from response:', typeof response);
  
  // Handle different response formats
  let responseData;
  
  try {
    // Handle string responses that might be JSON
    if (typeof response === 'string') {
      responseData = parseResponseText(response);
      if (!responseData) {
        // If parsing fails, treat as plain text
        responseData = { answer: response };
      }
    } else if (response?.type === 'complete' && response.response) {
      // It's already in the right format
      responseData = response.response;
    } else if (response?.type === 'full_ai_response' && response.response) {
      // Handle the new full_ai_response format
      responseData = {
        answer: response.response.fullText || '',
        steps: response.response.stepsPromise?.status?.value || []
      };
    } else if (response?.response && typeof response.response === 'object') {
      // It has a response property that's an object
      responseData = response.response;
    } else {
      // Just use the response as is
      responseData = response;
    }
  } catch (error) {
    console.error('Error processing response:', error);
    responseData = { answer: 'Sorry, there was an error processing the response.' };
  }
  
  // Extract content and metadata
  const content = responseData?.answer || 'Sorry, I didn\'t get a valid response.';
  
  const message = {
    id: `ai-${Date.now()}`,
    content: content,
    timestamp: new Date().toISOString(),
    sender: 'ai',
    metadata: {
      graphql_queries: responseData?.graphql_queries || [],
      entities: responseData?.entities || [],
      steps: responseData?.steps || [],
    }
  };
  
  console.log('Created message:', message);
  return message;
}; 