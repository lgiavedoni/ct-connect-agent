import { logger } from '../utils/logger.utils';
import { tool } from 'ai';
import { z } from 'zod';
import { aiRunPrompt, createNamedTool } from '../client/ai.client';

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

// Define the tool in the format expected by the AI SDK and assign a name
export const generateGraphQLQuery = createNamedTool(
  'generateGraphQLQuery',
  tool({
    description: 'This tool MUST be used FIRST to generate a valid GraphQL query based on a natural language request. It has access to the commercetools platform schema. After generating a query with this tool, you should then execute it using the executeGraphQLQuery tool.',
    parameters: z.object({
      request: z.string().describe('The natural language request to convert to a GraphQL query'),
      previous_queries: z.array(z.string()).describe('The previous queries that have been executed and failed (include the error message in the query). This is important to know so that you can generate a query that will return the correct data.')
    }),
    execute: async ({ request }) => {
      logger.info(`Generating GraphQL query for request: ${request}`);
      
      const generatedQuery = await aiRunPrompt(request, systemPrompt);
      
      logger.info(`Generated GraphQL Query: ${generatedQuery}`);
      return { query: generatedQuery.trim() };
    }
  })
);
