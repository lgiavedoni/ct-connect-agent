import { logger } from '../utils/logger.utils';
import { tool } from 'ai';
import { z } from 'zod';
import { aiRunPrompt, aiRunPromptWithUserPrompt, createNamedTool, model_openai_gpt_4_1,model_anthropic_3_7, model_flash, model_flash_thinking, model_openai_gpt_4_o, model_openai_o1_mini, model_openai_o3_mini } from '../client/ai.client';
import { FileUtils } from '../utils/file.utils';
import axios from 'axios';

const graphql_schema_url = `
  https://raw.githubusercontent.com/commercetools/commercetools-api-reference/refs/heads/main/api-specs/graphql/schema.sdl
`;

// Variable to store the GraphQL schema
let graphql_schema = '';

// Fetch the GraphQL schema from the URL
async function fetchGraphQLSchema() {
  try {
    const response = await axios.get(graphql_schema_url.trim());
    graphql_schema = response.data;
    logger.info('Successfully loaded GraphQL schema');
    return response.data;
  } catch (error) {
    logger.error('Failed to load GraphQL schema', error);
    return 'Error loading schema. Please check the URL and try again.';
  }
}

// Initialize by fetching the schema
fetchGraphQLSchema().then(schema => {
  graphql_schema = schema;
});

// Load grounding files content
let groundingContent_1, groundingContent_2, groundingContent_schema = '';


try {
  groundingContent_1 = FileUtils.loadFileContent('src/data/general_grounding.txt');
  logger.info('Successfully loaded general_grounding.txt');
} catch (error) {
  logger.error('Failed to load general_grounding.txt', error);
}

try {
  groundingContent_2 = FileUtils.loadFileContent('src/data/intro_grounding.txt');
  logger.info('Successfully loaded intro_grounding.txt');
} catch (error) {
  logger.error('Failed to load intro_grounding.txt', error);
}

try {
  groundingContent_schema = FileUtils.loadFileContent('src/data/schema.txt');
  logger.info('Successfully loaded schema.txt');
} catch (error) {
  logger.error('Failed to load schema.txt', error);
}


const systemPrompt = `
            You are a GraphQL query expert that will be given a natural language request and will need to convert it into a valid GraphQL query.
            All your queries will be executed (by another tools, never by yourself) against the commercetools platform. So make sure to use the correct fields and types.
            If the request can't be solved in a single query, you can split it into multiple queries. Or AT LEAST return the main one and provide feedback to the user.
            If there is absolutely no way to generate one (or many) valid query, return an empty string as the query and provide feedback to the user. But ALWAYS try your best to generate a query.

            Be very mindful of not adding any formating that can mess the query. This string will be executed as is. Not \n. And be careful with the ". So date filter should be like this: "createdAt >= \"2025-02-01T00:00:00.000Z\"". DO NOT add any additional \ or \\.

            If you have previous queries that have failed, take them into account to generate a new query. Never repeat the same mistakes.

            If your previous queries have failed, try different approaches. Example, if you can't filter by a field, try to filter by a related field. (like ID and email for customers)

            As much as possible try to always include the id and the name or any readible identifier for the object so the system and the user can identify the object. Follow your schema to know when this is possible.
            As much as possible try to always return information that can help the user identify the object and are human readable. Name, email, date, etc.

            sortOrder: Every time that you have to define a sortOrder, use at least 3 decimals, the user will provide a random number to use as sortOrder. Example: 0.724
            Marketing considerations:
            - When you need to set a name that will be shown to the user, use something that a marketing team would use.
            - Example of a good name for DiscountCode.code: "SUMMER_SALE_2025"
            

            
            By default (unless directly specified) always use current and master variant. Example: { products { results { id version masterData { current { masterVariant { id prices { id value { centAmount currencyCode } } } } } } } }
            When you make changes on product, ask the user if they want to publish the changes. Bc those changes won't be "online" till they have the status as published.
            
            Use the following grounding to help you:
            <grounding_examples>
            ${groundingContent_1}
            ${groundingContent_2}
            ${groundingContent_schema}
            </grounding_examples>
            
            
            Use the following schema as a reference:
            <commercetools_schema>
            ${graphql_schema}
            </commercetools_schema>

            <return_format>
              Always return the following JSON structure:
              {
                "query": "<generated_query>", # Be very mindful of not adding any formating that can mess the query. This string will be executed as is. Not \n. So date filter should be like this: "createdAt >= \"2025-02-01T00:00:00.000Z\"".
                "feedback": "<feedback_to_user>" # Here you can provide feedback to the user about the query or follow up queries or ideas on how to complete the request.
              }
            </return_format>
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

// Function to generate random sortOrder that doesn't end with 0
const generateRandomSortOrder = (): string => {
  let randomNum;
  do {
    randomNum = Math.random().toFixed(3);
  } while (randomNum.endsWith('0'));
  return randomNum;
};

// Define the tool in the format expected by the AI SDK and assign a name
export const generateGraphQLQuery = createNamedTool(
  'generateGraphQLQuery',
  tool({
    description: `Tool used to generate a valid GraphQL query based on a natural language request. 
                  This tool can do queries and mutations.
                  It has access to the commercetools platform schema. 
                  After generating a query with this tool, you should then execute it using the executeGraphQLQuery tool.
                  This tool ONLY returns the generated query, don't ask for any type of operation, only converts the request into a valid GraphQL query.
                  This tools will NEVER execute the query, only generate it. So it can't create, update or delete data.
                  
                  `,
    parameters: z.object({
      request: z.string().describe('The natural language request that you want to convert to graphql'),
      context: z.string().describe('Any additional context/data that will help this tool to create the query. Example: If you want to do something with a specific object, provide the at least the object id. If you have the entire object, provide the entire object, much better'),
      failed_previous_queries: z.array(z.string()).describe('ALL the previous queries that have been executed and failed (include the error message in the query). Send an empty array if there are no previous queries.')
    }),
    execute: async ({ request, failed_previous_queries = [], context = '' }) => {
      logger.info(`Generating GraphQL query for request: ${request}, with previous queries [${failed_previous_queries.length}] and context: ${context}`);//, \n Previous queries: ${failed_previous_queries}

      // Ensure schema is loaded before proceeding
      if (!graphql_schema) {
        logger.info('Schema not loaded yet, fetching it now...');
        graphql_schema = await fetchGraphQLSchema();
      }

      if (context) {
        request = `${request}\n\n Additional context: ${context}`;
      }
      request = `${request}\n\n When you need a random sortOrder use one of the following: ${generateRandomSortOrder()}, ${generateRandomSortOrder()}, ${generateRandomSortOrder()}`;


      if (failed_previous_queries.length > 0) {
        const previous_queries_string = failed_previous_queries.join('\n');
        // logger.info(`Previous queries: ${previous_queries_string}`);
        request = `${request}\n\n. 
                  IMPORTANT, take into account the previous queries that have failed and avoid the same mistakes:\n${previous_queries_string}
                  `;
      }

      const generatedQuery = await aiRunPromptWithUserPrompt(systemPrompt, request, undefined, model_openai_gpt_4_1);//model_flash_thinking);//model_openai_gpt_4_o
      
      // Clean the generated query
      const cleanedQuery = cleanGraphQLQuery(generatedQuery);
      
      logger.info(`Generated GraphQL Query: ${cleanedQuery}`);
      return { query: cleanedQuery };
    }
  })
);
