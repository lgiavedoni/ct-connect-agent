import { google } from '@ai-sdk/google';
import { generateText, Tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { logger } from '../utils/logger.utils';

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// const model = googleAI('gemini-2.0-flash');
const model_flash = googleAI('gemini-2.0-flash');
const model_anthropic = anthropic('claude-3-7-sonnet-20250219');

/**
 * Helper function to create a tool with a name
 * @param name The name to use for the tool
 * @param toolObj The tool object
 * @returns The tool with a toolName property
 */
export const createNamedTool = <T extends Tool>(name: string, toolObj: T): T & { toolName: string } => {
  return Object.assign(toolObj, { toolName: name });
};

export const aiRunPrompt = async (user_prompt: string, system_prompt: string, tools?: Tool[] | Record<string, Tool>) => {

  // logger.info(`aiRunPrompt: system_prompt1: ${system_prompt} \n user_prompt: ${user_prompt}`);

  // Convert tools array to object if it's an array
  const toolsObject = Array.isArray(tools) 
    ? tools.reduce((acc: Record<string, Tool>, tool: any) => {
        // Use the toolName property if available, otherwise fallback to index
        const toolName = tool.toolName || `tool_${Object.keys(acc).length}`;
        return { ...acc, [toolName]: tool };
      }, {})
    : tools;

  const { text } = await generateText({
    model: model_anthropic,
    prompt: user_prompt,
    system: system_prompt,
    maxSteps: 3,
    tools: toolsObject
  });
  
  return text;
}