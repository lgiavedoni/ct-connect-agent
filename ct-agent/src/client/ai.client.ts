import { google } from '@ai-sdk/google';
import { generateText, Tool, Message } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { logger } from '../utils/logger.utils';

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// const model = googleAI('gemini-2.0-flash');
export const model_flash = googleAI('gemini-2.0-flash');
export const model_flash_thinking = googleAI('gemini-2.0-flash-thinking-exp-01-21');
export const model_anthropic_3_7 = anthropic('claude-3-7-sonnet-20250219');
export const model_openai_o1_mini = openai('o1-mini');
export const model_openai_o3_mini = openai('o3-mini');
export const model_openai_gpt_4_5 = openai('gpt-4.5-preview');
export const model_openai_gpt_4_o = openai('gpt-4o');

/**
 * Helper function to create a tool with a name
 * @param name The name to use for the tool
 * @param toolObj The tool object
 * @returns The tool with a toolName property
 */
export const createNamedTool = <T extends Tool>(name: string, toolObj: T): T & { toolName: string } => {
  return Object.assign(toolObj, { toolName: name });
};

/**
 * Run a prompt through an AI model
 * @param system_prompt The system prompt
 * @param messages The array of messages
 * @param tools Optional tools to provide to the model
 * @param model Optional model to use (defaults to model_flash)
 * @returns The generated text
 */
export const aiRunPrompt = async (
  system_prompt: string,
  messages: Message[],
  tools?: Tool[] | Record<string, Tool>,
  model = model_flash
) => {

  // logger.info(`aiRunPrompt: system_prompt1: ${system_prompt} \n user_prompt: ${user_prompt}`);

  // Convert tools array to object if it's an array
  const toolsObject = Array.isArray(tools) 
    ? tools.reduce((acc: Record<string, Tool>, tool: any) => {
        // Use the toolName property if available, otherwise fallback to index
        const toolName = tool.toolName || `tool_${Object.keys(acc).length}`;
        return { ...acc, [toolName]: tool };
      }, {})
    : tools;

  // Use unshift to add the system message at the beginning of the array
  messages.unshift({
    role: 'system',
    content: system_prompt,
    id: 'system',
  });

  const { text } = await generateText({
    model,
    messages: messages,
    maxSteps: 15,
    tools: toolsObject,
    providerOptions: {

      // openai: { model: 'o3-mini', reasoningEffort: 'medium' },
    },
  });
  
  return text;
}



/**
 * Run a prompt through an AI model with a single user prompt
 * @param system_prompt The system prompt
 * @param user_prompt The user's prompt
 * @param tools Optional tools to provide to the model
 * @param model Optional model to use (defaults to model_flash)
 * @returns The generated text
 */
export const aiRunPromptWithUserPrompt = async (
  system_prompt: string,
  user_prompt: string,
  tools?: Tool[] | Record<string, Tool>,
  model = model_flash
) => {
  const messages: Message[] = [{
    role: 'user',
    content: user_prompt,
    id: 'user',
  }];

  return aiRunPrompt(system_prompt, messages, tools, model);
};