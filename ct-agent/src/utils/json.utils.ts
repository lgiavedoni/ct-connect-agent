/**
 * Utility functions for JSON operations
 */

/**
 * Cleans JSON strings that might be wrapped in markdown code blocks
 * @param jsonString - The JSON string that might contain markdown code blocks
 * @returns The cleaned JSON object
 */
export const cleanJson = (jsonString: string): Record<string, any> => {
  try {
    // If it's already an object, return it
    if (typeof jsonString === 'object') {
      return jsonString;
    }

    // Remove markdown code blocks if present
    let cleaned = jsonString.trim();
    
    // Remove ```json and ``` markers
    const jsonCodeBlockRegex = /^```json\s*([\s\S]*?)\s*```$/;
    const codeBlockMatch = cleaned.match(jsonCodeBlockRegex);
    
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    } else {
      // Try to match just the triple backticks without language specification
      const genericCodeBlockRegex = /^```\s*([\s\S]*?)\s*```$/;
      const genericMatch = cleaned.match(genericCodeBlockRegex);
      if (genericMatch) {
        cleaned = genericMatch[1].trim();
      }
    }

    // Parse the cleaned string to an object
    return JSON.parse(cleaned);
  } catch (error: unknown) {
    console.error('Error cleaning JSON:', error);
    throw new Error(`Failed to clean or parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 