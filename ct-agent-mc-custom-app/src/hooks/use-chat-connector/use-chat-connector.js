import { useState, useRef, useEffect } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { actions } from '@commercetools-frontend/sdk';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import { createMessageFromResponse } from '../../models/chat-response';

export const useChatConnector = () => {
  const { environment } = useApplicationContext();
  const AI_AGENT_API_URL = environment?.AI_AGENT_API_URL || 'https://9447-188-26-215-219.ngrok-free.app/agent';
  
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
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const dispatch = useAsyncDispatch();
  const { projectKey } = useApplicationContext();
  
  // Use a ref to track if the component is mounted
  const isMounted = useRef(true);
  
  // Set isMounted to false when the component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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

      // Use the Merchant Center Proxy Router to forward the request to the external API
      const response = await dispatch(
        actions.forwardTo.post({
          uri: AI_AGENT_API_URL,
          payload: {
            messages: chatHistory,
          },
          // The following headers are required for the Merchant Center Proxy Router
          headers: {
            'Accept-Version': 'v1',
          },
          // Extended timeout (in milliseconds) for longer API processing time
          timeout: 60000, // 60 seconds timeout
        })
      );
      
      // Only update state if the component is still mounted
      if (isMounted.current) {
        // Create AI response message from the API response using our model
        const aiResponse = createMessageFromResponse(response);
        setMessages((prevMessages) => [...prevMessages, aiResponse]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Only update state if the component is still mounted
      if (isMounted.current) {
        setError(err);
        
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
    } finally {
      // Only update state if the component is still mounted
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  };
}; 