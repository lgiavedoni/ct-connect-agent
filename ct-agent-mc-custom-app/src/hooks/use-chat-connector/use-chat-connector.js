import { useState } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { actions } from '@commercetools-frontend/sdk';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';

// Get the API URL from environment variables
const AI_AGENT_API_URL = process.env.REACT_APP_AI_AGENT_API_URL || 'https://68bf-2a0c-5a84-b207-900-cc63-222a-f414-edce.ngrok-free.app/agent';

export const useChatConnector = () => {
  const [messages, setMessages] = useState([
    {
      id: 'system-welcome',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date().toISOString(),
      sender: 'ai',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const dispatch = useAsyncDispatch();
  const { projectKey } = useApplicationContext();

  const sendMessage = async (messageText) => {
    if (!messageText.trim()) return;

    // Add user message to the chat
    const userMessage = {
      id: `user-${Date.now()}`,
      content: messageText,
      timestamp: new Date().toISOString(),
      sender: 'user',
    };
    
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Use the Merchant Center Proxy Router to forward the request to the external API
      const response = await dispatch(
        actions.forwardTo.post({
          uri: AI_AGENT_API_URL,
          payload: {
            human_request: messageText,
          },
          // The following headers are required for the Merchant Center Proxy Router
          headers: {
            'Accept-Version': 'v1',
          },
        })
      );
      
      // Create AI response message from the API response
      const aiResponse = {
        id: `ai-${Date.now()}`,
        content: response?.response || 'Sorry, I didn\'t get a valid response.',
        timestamp: new Date().toISOString(),
        sender: 'ai',
      };

      setMessages((prevMessages) => [...prevMessages, aiResponse]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err);
      
      // Add error message to chat
      const errorMessage = {
        id: `error-${Date.now()}`,
        content: `Error: ${err.message || 'Failed to get response from AI assistant'}. Make sure your API server is running at ${AI_AGENT_API_URL} and is properly configured to accept requests from the Merchant Center.`,
        timestamp: new Date().toISOString(),
        sender: 'system',
      };
      
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  };
}; 