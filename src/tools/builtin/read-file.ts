import fs from 'fs/promises';
import path from 'path';
import { Tool } from '../index.js';

export class ReadFileTool implements Tool {
  name = 'read_file';
  description = 'Reads the contents of a file on the local file system. Absolute paths are preferred.';
  parameters = {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'The path to the file to read.',
      },
    },
    required: ['filePath'],
  };

  async execute(args: { filePath: string }): Promise<string> {
    try {
      const targetPath = path.resolve(args.filePath);
      const stat = await fs.stat(targetPath);
      const MAX_SIZE = 1024 * 1024; // 1MB limit
      if (stat.size > MAX_SIZE) {
        return `Error: File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: 1MB. Use execute_bash to read it in chunks.`;
      }
      const content = await fs.readFile(targetPath, 'utf-8');
      return content;
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  }
}
