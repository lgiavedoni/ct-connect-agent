import { useState, useRef, useEffect } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { actions } from '@commercetools-frontend/sdk';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import { createMessageFromResponse } from '../../models/chat-response';

export const useChatConnector = () => {
  const { environment } = useApplicationContext();
  const AI_AGENT_API_URL = environment?.AI_AGENT_API_URL;
  
  console.log('AI Agent API URL:', AI_AGENT_API_URL);
  
  const [messages, setMessages] = useState([
    {
      id: 'system-welcome',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date().toISOString(),
      sender: 'ai',
      metadata: {
        graphql_queries: [],
        entities: [],
      },
      isMarkdown: true,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const dispatch = useAsyncDispatch();
  const { projectKey } = useApplicationContext();
  
  // Request ID ref to track current request
  const currentRequestIdRef = useRef(null);
  
  // Polling interval ref
  const pollingIntervalRef = useRef(null);
  
  // Last chunk ID processed
  const lastChunkIdRef = useRef(-1);
  
  // Use a ref to track if the component is mounted
  const isMounted = useRef(true);
  
  // Set isMounted to false when the component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      
      // Clear any active polling intervals
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Function to handle real-time streaming using progressive polling
  const startRealTimeStreaming = async (streamingMessageId, requestId, chatHistory) => {
    if (!isMounted.current) return;
    
    try {
      console.log(`Starting real-time streaming for request ${requestId}`);
      
      // Reset the last chunk ID to -1 to ensure we capture the first chunk (ID 0)
      lastChunkIdRef.current = -1;
      
      // Start the processing on the server but don't wait for complete response
      await dispatch(
        actions.forwardTo.post({
          uri: AI_AGENT_API_URL,
          payload: {
            messages: chatHistory,
            requestId,
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Version': 'v1',
          }
        })
      );
      
      // Start polling for updates
      const pollForChunks = async () => {
        if (!isMounted.current || currentRequestIdRef.current !== requestId) {
          // Stop polling if component unmounted or request changed
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return null;
        }
        
        try {
          // Request new chunks since the last one we processed
          // Use POST instead of GET to bypass ngrok security confirmation page
          const streamResponse = await dispatch(
            actions.forwardTo.post({
              // Use the dedicated streaming endpoint
              uri: `${AI_AGENT_API_URL}/stream`,
              // Pass polling parameters in the payload
              payload: {
                requestId: requestId,
                since: lastChunkIdRef.current
              },
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Version': 'v1',
              }
            })
          );
          
          console.log('Stream response:', streamResponse);
          
          // IMMEDIATELY stop polling if the backend tells us to
          if (streamResponse.stopPolling) {
            console.log('Received stop polling signal from backend, stopping immediately');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // Process any new chunks
          if (streamResponse.chunks && streamResponse.chunks.length > 0) {
            console.log(`Received ${streamResponse.chunks.length} new chunks, lastChunkId: ${lastChunkIdRef.current}`);
            
            let fullContent = '';
            
            // If we received the stop polling signal or the request is complete
            // AND we have a finalResponse, use the complete answer
            if ((streamResponse.stopPolling || streamResponse.isComplete) && 
                 streamResponse.finalResponse && 
                 streamResponse.finalResponse.answer) {
              
              console.log('Using complete answer from finalResponse');
              
              // Use the complete answer for final display
              setMessages(prevMessages => {
                return prevMessages.map(msg => {
                  if (msg.id === streamingMessageId) {
                    return {
                      ...msg,
                      // Replace with the complete answer since we're done
                      content: streamResponse.finalResponse.answer,
                      metadata: {
                        graphql_queries: streamResponse.finalResponse.graphql_queries || [],
                        entities: streamResponse.finalResponse.entities || [],
                      },
                      isStreaming: false,
                      isMarkdown: true,
                    };
                  }
                  return msg;
                });
              });
            } else {
              // Process chunks and ALWAYS append during streaming
              streamResponse.chunks.forEach(chunk => {
                // Update the last chunk ID
                if (chunk.id > lastChunkIdRef.current) {
                  if (chunk.type === 'chunk' && chunk.text) {
                    console.log(`Processing chunk ${chunk.id}: "${chunk.text.substring(0, 20)}${chunk.text.length > 20 ? '...' : ''}"`);
                    // Accumulate the text for this update batch
                    fullContent += chunk.text;
                  } else if (chunk.type === 'error') {
                    console.error('Error in stream:', chunk.text);
                    setError(new Error(chunk.text));
                  }
                  
                  // Always update the last chunk ID, even for error chunks
                  lastChunkIdRef.current = chunk.id;
                } else {
                  console.log(`Skipping already processed chunk ${chunk.id}`);
                }
              });
              
              // Only update the UI once with the accumulated content from all chunks
              if (fullContent) {
                console.log(`Updating UI with new content: "${fullContent.substring(0, 20)}${fullContent.length > 20 ? '...' : ''}"`);
                
                setMessages(prevMessages => {
                  return prevMessages.map(msg => {
                    if (msg.id === streamingMessageId) {
                      const newContent = msg.content + fullContent;
                      console.log(`Message content now: "${newContent.substring(0, 30)}${newContent.length > 30 ? '...' : ''}"`);
                      
                      return {
                        ...msg,
                        // ALWAYS append to existing content during streaming
                        content: newContent,
                        isMarkdown: true,
                      };
                    }
                    return msg;
                  });
                });
              }
            }
          } else {
            console.log('No new chunks received');
          }
          
          // Check if processing is complete
          if (streamResponse.isComplete) {
            // Stop polling - we're done
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            
            // Update metadata and mark as complete
            setIsStreaming(false);
            setIsLoading(false);
            
            // If we have a final response, update the message with the full content immediately
            if (streamResponse.finalResponse) {
              setMessages(prevMessages => {
                return prevMessages.map(msg => {
                  if (msg.id === streamingMessageId) {
                    // Get the answer from the final response
                    const fullContent = streamResponse.finalResponse.answer || '';
                    
                    return {
                      ...msg,
                      // Replace any partial content with the complete answer
                      content: fullContent,
                      metadata: {
                        graphql_queries: streamResponse.finalResponse.graphql_queries || [],
                        entities: streamResponse.finalResponse.entities || [],
                      },
                      isStreaming: false,
                      isMarkdown: true,
                    };
                  }
                  return msg;
                });
              });
            } else {
              // Just mark as not streaming if there's no final response
              setMessages(prevMessages => {
                return prevMessages.map(msg => {
                  if (msg.id === streamingMessageId) {
                    return {
                      ...msg,
                      isStreaming: false,
                      isMarkdown: true,
                    };
                  }
                  return msg;
                });
              });
            }
          }
          
          // Return the response so we can check outside the function
          return streamResponse;
        } catch (error) {
          console.error('Error polling for chunks:', error);
          // We'll try again on the next interval
          return null;
        }
      };
      
      // Poll immediately once
      const initialPollResult = await pollForChunks();
      
      // Then set up regular polling - but only if the response isn't already complete
      if (initialPollResult && !initialPollResult.isComplete) {
        pollingIntervalRef.current = setInterval(pollForChunks, 500);
      }
    } catch (error) {
      console.error('Error starting real-time streaming:', error);
      if (isMounted.current) {
        setError(error);
        setIsStreaming(false);
        setIsLoading(false);
      }
    }
  };

  const sendMessage = async (messageText) => {
    if (!messageText.trim()) return;

    // Add user message to the chat
    const userMessage = {
      id: `user-${Date.now()}`,
      content: messageText,
      timestamp: new Date().toISOString(),
      sender: 'user',
      metadata: {
        graphql_queries: [],
        entities: [],
      },
    };
    
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsLoading(true);
    setError(null);
    setIsStreaming(false);
    setStreamedContent('');

    try {
      // Convert existing messages to the format expected by the API
      const chatHistory = messages.map(msg => ({
        id: msg.id,
        createdAt: new Date(msg.timestamp),
        content: msg.content,
        role: msg.sender === 'user' ? 'user' : msg.sender === 'ai' ? 'assistant' : 'system'
      }));
      
      // Add the new user message to the chat history
      chatHistory.push({
        id: userMessage.id,
        createdAt: new Date(userMessage.timestamp),
        content: userMessage.content,
        role: 'user'
      });

      // Create a streaming AI response placeholder
      const streamingMessageId = `ai-${Date.now()}`;
      const streamingMessage = {
        id: streamingMessageId,
        content: '',  // Start with empty content for streaming
        timestamp: new Date().toISOString(),
        sender: 'ai',
        metadata: {
          graphql_queries: [],
          entities: [],
        },
        isStreaming: true,
        isMarkdown: true,
      };
      
      // Add the placeholder message
      setMessages((prevMessages) => [...prevMessages, streamingMessage]);
      setIsStreaming(true);

      console.log('Sending request to:', AI_AGENT_API_URL);
      
      // Generate a unique request ID
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      currentRequestIdRef.current = requestId;
      
      // Start real-time streaming with polling
      await startRealTimeStreaming(streamingMessageId, requestId, chatHistory);
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Only update state if the component is still mounted
      if (isMounted.current) {
        setError(err);
        setIsStreaming(false);
        setIsLoading(false);
        
        // Add error message to chat
        const errorMessage = {
          id: `error-${Date.now()}`,
          content: `Error: Failed to fetch. Make sure your API server is running at ${AI_AGENT_API_URL} and is properly configured to accept requests from the Merchant Center.`,
          timestamp: new Date().toISOString(),
          sender: 'system',
          metadata: {
            graphql_queries: [],
            entities: [],
          },
        };
        
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      }
    }
  };

  return {
    messages,
    isLoading,
    isStreaming,
    streamedContent,
    error,
    sendMessage,
  };
}; 