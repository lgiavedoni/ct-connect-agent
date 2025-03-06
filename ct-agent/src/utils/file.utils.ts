import fs from 'fs';
import path from 'path';
import { logger } from './logger.utils';

/**
 * Utility class for file operations
 */
export class FileUtils {
  /**
   * Loads the content of a file
   * @param filePath - Path to the file relative to the project root
   * @returns The content of the file as a string
   * @throws Error if the file cannot be found or read
   */
  public static loadFileContent(filePath: string): string {
    try {
      // Resolve the absolute path
      const absolutePath = path.resolve(process.cwd(), filePath);
      
      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Read and return file content
      return fs.readFileSync(absolutePath, 'utf8');
    } catch (error) {
      logger.error(`Failed to load file: ${filePath}`, error);
      throw new Error(`Failed to load file: ${filePath}. ${(error as Error).message}`);
    }
  }
} 