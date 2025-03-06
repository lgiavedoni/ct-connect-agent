import { logger } from '../utils/logger.utils';
import { tool } from 'ai';
import { z } from 'zod';
import graphqlClient from '../client/graphqlExecution.client';
import { createNamedTool } from '../client/ai.client';

/**
 * Cleans a GraphQL query by removing potentially problematic characters
 * @param query The GraphQL query to clean
 * @returns The cleaned GraphQL query
 */
const cleanQuery = (query: string): string => {
  let processedQuery = query;
  
  // Handle escaped characters
  if (typeof query === 'string') {
    // Replace escaped newlines with spaces
    processedQuery = processedQuery.replace(/\\n/g, ' ');
    
    // Replace escaped quotes with regular quotes
    processedQuery = processedQuery.replace(/\\"/g, '"');
    
    // Remove literal newlines
    processedQuery = processedQuery.replace(/\n/g, ' ');
  }
  
  // Remove extra spaces
  let cleanedQuery = processedQuery.replace(/\s+/g, ' ').trim();
  
  // Ensure proper GraphQL query format if needed
  if (cleanedQuery && !cleanedQuery.startsWith('query ') && !cleanedQuery.startsWith('mutation ') && !cleanedQuery.startsWith('{')) {
    cleanedQuery = `{ ${cleanedQuery} }`;
  }
  
  logger.debug(`Original query: ${query}`);
  logger.debug(`Cleaned query: ${cleanedQuery}`);
  
  return cleanedQuery;
};

// Define the tool in the format expected by the AI SDK and assign a name
export const executeGraphQLQuery = createNamedTool(
  'executeGraphQLQuery',
  tool({
    description: 'Executes a GraphQL query against the commercetools platform. This tool ONLY executes queries and does NOT generate them. You must first use the generateGraphQLQuery tool to create a valid query before executing it.',
    parameters: z.object({
      query: z.string().describe('The GraphQL query to execute (must be a valid GraphQL query)')
    }),

    execute: async ({ query }) => {
      // Clean the query before execution
      logger.info(`Executing GraphQL query: ${query}`);

      // TODO: REmoving cleaning for now to avoid issues with the query.
      const cleanedQuery = query;
      
      // const cleanedQuery = cleanQuery(query);
      // logger.info(`Executing GraphQL query [cleaned]: ${cleanedQuery}`);

      try {
        const response = await graphqlClient.query(cleanedQuery);

        logger.info(`GraphQL Query Response: ${response}`); 
        return { response };
      } catch (error) {
        logger.error(`Error executing GraphQL query: ${error}`);
        // Return a clear error message that indicates the query needs to be fixed
        return { 
          error: true,
          response: `Error executing GraphQL query: ${error}. Please use the generateGraphQLQuery tool to create a valid query.` 
        };
      }
    }
  })
);
