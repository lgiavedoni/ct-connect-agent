import { tool } from 'ai';
import { z } from 'zod';
import { aiRunPrompt, createNamedTool } from '../client/ai.client';

// Define a weather tool with a custom name using the helper function
const weatherTool = createNamedTool(
  'getWeather',
  tool({
    description: 'Get the weather for a specific location',
    parameters: z.object({
      location: z.string().describe('The location to get the weather for')
    }),
    execute: async ({ location }) => {
      // Mock weather data
      return {
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
        conditions: ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)]
      };
    }
  })
);

// Define a time tool with a custom name using the helper function
const timeTool = createNamedTool(
  'getCurrentTime',
  tool({
    description: 'Get the current time for a specific location',
    parameters: z.object({
      location: z.string().describe('The location to get the time for')
    }),
    execute: async ({ location }) => {
      return {
        location,
        time: new Date().toLocaleTimeString(),
        timezone: 'UTC'
      };
    }
  })
);

// Example of using tools with custom names
async function runExample() {
  const systemPrompt = `
    You are a helpful assistant that can provide weather and time information.
    Use the tools available to you to answer the user's questions.
  `;
  
  const userPrompt = 'What is the weather in New York and what time is it in London?';
  
  // Using an array - the AI client will use the toolName property
  const response = await aiRunPrompt(
    userPrompt,
    systemPrompt,
    [weatherTool, timeTool]
  );
  
  console.log('Response with tools using toolName property:', response);
}

// Run the example
// runExample().catch(console.error);

export { weatherTool, timeTool, runExample }; 