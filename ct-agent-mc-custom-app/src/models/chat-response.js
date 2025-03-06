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
 * @typedef {Object} ChatResponse
 * @property {string} response - The text response to the user's request
 * @property {GraphQLQuery[]} [graphql_query] - Array of GraphQL queries executed
 * @property {Entity[]} [entities] - Array of entities involved in the operation
 */

/**
 * Creates a message object from the API response
 * 
 * @param {ChatResponse} response - The response from the API
 * @returns {Object} A message object with the response content and metadata
 */
export const createMessageFromResponse = (response) => {
  return {
    id: `ai-${Date.now()}`,
    content: response?.answer || 'Sorry, I didn\'t get a valid response.',
    timestamp: new Date().toISOString(),
    sender: 'ai',
    metadata: {
      graphql_queries: response?.graphql_queries || [],
      entities: response?.entities || [],
    }
  };
}; 