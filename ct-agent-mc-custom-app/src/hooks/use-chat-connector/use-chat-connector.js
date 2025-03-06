import { useState } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { actions } from '@commercetools-frontend/sdk';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import { createMessageFromResponse } from '../../models/chat-response';

// Get the API URL from environment variables
const AI_AGENT_API_URL = process.env.REACT_APP_AI_AGENT_API_URL || 'https://68bf-2a0c-5a84-b207-900-cc63-222a-f414-edce.ngrok-free.app/agent';

export const useChatConnector = () => {
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
      
      // FOR TESTING PURPOSES ONLY - REMOVE IN PRODUCTION
      // This simulates a response with GraphQL queries and entities
      if (process.env.NODE_ENV === 'development' && !response) {
        const testResponse = {
          response: `Here's information about the product you requested: Classic White T-Shirt, price: $19.99, available in sizes S, M, L, XL. I've also found 3 recent orders for this product.`,
          graphql_query: [
            {
              query: `
query {
  products(where: "name=\\"Classic White T-Shirt\\"") {
    results {
      id
      name
      masterData {
        current {
          name
          description
          variants {
            prices {
              value {
                centAmount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
}`,
              query_type: 'Read',
            },
            {
              query: `
query {
  orders(where: "lineItems(name=\\"Classic White T-Shirt\\")", limit: 3, sort: "createdAt desc") {
    results {
      id
      orderNumber
      createdAt
      customerEmail
      totalPrice {
        centAmount
        currencyCode
      }
    }
  }
}`,
              query_type: 'Read',
            }
          ],
          entities: [
            {
              entity_type: 'Products',
            },
            {
              entity_type: 'Orders',
            }
          ]
        };
        
        // Create AI response message from the test response
        const aiResponse = createMessageFromResponse(testResponse);
        setMessages((prevMessages) => [...prevMessages, aiResponse]);
        setIsLoading(false);
        return;
      }
      
      // Create AI response message from the API response using our model
      const aiResponse = createMessageFromResponse(response);

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
        metadata: {
          graphql_queries: [],
          entities: [],
        },
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