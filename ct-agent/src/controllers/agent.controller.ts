import { Request, Response } from 'express';
import { logger } from '../utils/logger.utils';
import { aiRunPrompt } from '../client/ai.client';
import graphqlClient from '../client/graphql.client'; 
import CustomError from '../errors/custom.error';
import { generateGraphQLQuery } from '../tools/graphqlGeneration.tool';
import { executeGraphQLQuery } from '../tools/graphqlExecutor.tool';

// import {
//   HTTP_STATUS_RESOURCE_NOT_FOUND,
//   HTTP_STATUS_SUCCESS_ACCEPTED,
//   HTTP_STATUS_BAD_REQUEST,
//   HTTP_STATUS_SUCCESS_NO_CONTENT,
// } from '../constants/http.status.constants';

interface AgentRequest extends Request {
  body: {
    human_request?: string;
    [key: string]: unknown;
  };
}

const systemPrompt: string = `
    You are a helpful customer service assistant that manages a commercetools store.
    
    IMPORTANT: For ANY request that requires data from the commercetools platform, you MUST follow this exact sequence:
    1. FIRST use the generateGraphQLQuery tool to create the appropriate query based on the user's request
    2. THEN use the executeGraphQLQuery tool to execute the generated query
    3. FINALLY interpret the response and return the result to the user in a natural language format

    NEVER try to execute a GraphQL query directly without first generating it with the generateGraphQLQuery tool.
    NEVER try to create a GraphQL query yourself - always use the generateGraphQLQuery tool.
    
    For example, if the user asks "give me the total of the last 10 orders", you should:
    1. Use generateGraphQLQuery with the request "get the total of the last 10 orders"
    2. Take the generated query and pass it to executeGraphQLQuery
    3. Format the response in a user-friendly way

    When there is an error with the GraphQL query, you will need to fix it by using the generateGraphQLQuery tool again and providing the error message.
    Only use the GraphQL tools when necessary - not all requests need to interact with the database.
    The user is a human, so your response should be in a natural language and easy to understand.


    Return the response in the following format:
    {
      "response": "The response to the user's request",
      "graphql_query": [
        {
          "query": "The generated GraphQL query that where successfully executed",
          "query_type": "The type of the query that was executed. Example: Read, Write",
        }
      ],
      "entities": [
        {
          "entity_type": "The type of the entity that has been involved in this oporation. Example: Products, Orders..",
        }
      ]
    }
`;

export const angetHandler = async (request: AgentRequest, response: Response): Promise<Response> => {
  try {
    const human_request = request.body.human_request;
    if (!human_request) {
      logger.error('Missing human_request in request body.');
      throw new CustomError(
        400,
        'Bad request: No human_request is defined in request body',
        undefined
      );
    }

    logger.info(`Processing request: ${human_request}`);
    const aiResponse = await aiRunPrompt(
      human_request, 
      systemPrompt, 
      [generateGraphQLQuery, executeGraphQLQuery]
    );

    logger.info(`AI Response: ${aiResponse}`);
    return response.json({
      response: aiResponse
    });
  } catch (err: unknown) {
    logger.error(err);
    console.log(err);
    if (err instanceof CustomError) {
      return response.status(Number(err.statusCode)).send(err);
    }
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      return response.status(Number((err as { statusCode: number | string }).statusCode)).send(err);
    }
    return response.status(500).send(err);
  }
};
