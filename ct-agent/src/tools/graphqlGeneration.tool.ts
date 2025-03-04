import { logger } from '../utils/logger.utils';
import { tool } from 'ai';
import { z } from 'zod';
import { aiRunPrompt, createNamedTool, model_anthropic_3_7, model_flash, model_openai_o1_mini, model_openai_o3_mini } from '../client/ai.client';

const graphql_schema = `
  https://github.com/commercetools/commercetools-api-reference/blob/main/api-specs/graphql/schema.sdl
`;

const systemPrompt = `
You are a GraphQL query expert that will be given a natural language request and will need to convert it into a valid GraphQL query.
All your queries will be executed agains the commercetools platform. So make sure to use the correct fields and types.

Return ONLY the GraphQL query without any explanations or markdown formatting.

Use the following schema as a reference:
${graphql_schema}
`;

/**
 * Cleans a GraphQL query string by removing markdown formatting, code blocks, and other unwanted elements.
 * @param queryString The raw query string to clean
 * @returns A cleaned GraphQL query string
 */
const cleanGraphQLQuery = (queryString: string): string => {
  // Remove markdown code blocks (```graphql, ```, etc.)
  let cleaned = queryString.replace(/```(?:graphql)?\s*([\s\S]*?)\s*```/g, '$1');
  
  // If no code blocks were found, use the original string
  if (cleaned === queryString) {
    cleaned = queryString;
  }
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // Remove any explanatory text before or after the query
  // This regex looks for the first { and the last } to extract just the query
  const queryMatch = cleaned.match(/\{[\s\S]*\}/);
  if (queryMatch) {
    cleaned = queryMatch[0];
  }
  
  return cleaned;
};

// Define the tool in the format expected by the AI SDK and assign a name
export const generateGraphQLQuery = createNamedTool(
  'generateGraphQLQuery',
  tool({
    description: 'This tool MUST be used FIRST to generate a valid GraphQL query based on a natural language request. It has access to the commercetools platform schema. After generating a query with this tool, you should then execute it using the executeGraphQLQuery tool.',
    parameters: z.object({
      request: z.string().describe('The natural language request to convert to a GraphQL query'),
      previous_queries: z.array(z.string()).describe('The previous queries that have been executed and failed (include the error message in the query). This is important to know so that you can generate a query that will return the correct data.')
    }),
    execute: async ({ request, previous_queries }) => {
      logger.info(`Generating GraphQL query for request: ${request}, with previous queries [${previous_queries.length}]`);

      if (previous_queries.length > 0) {
        const previous_queries_string = previous_queries.join('\n');
        // logger.info(`Previous queries: ${previous_queries_string}`);
        request = `${request}\n\n. 
                  IMPORTANT, take into account the previous queries that have failed:\n${previous_queries_string}`;
      }

      const generatedQuery = await aiRunPrompt(request, systemPrompt, undefined, model_openai_o3_mini);
      
      // Clean the generated query
      const cleanedQuery = cleanGraphQLQuery(generatedQuery);
      
      logger.info(`Generated GraphQL Query: ${cleanedQuery}`);
      return { query: cleanedQuery };
    }
  })
);
