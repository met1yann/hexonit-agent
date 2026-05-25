import fs from 'fs/promises';
import path from 'path';
import { Tool } from '../index.js';

export class WriteFileTool implements Tool {
  name = 'write_file';
  description = 'Writes content to a file on the local file system. If the file exists, it will be overwritten. Absolute paths are preferred.';
  parameters = {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'The path to the file to write to.',
      },
      content: {
        type: 'string',
        description: 'The content to write into the file.',
      },
    },
    required: ['filePath', 'content'],
  };

  async execute(args: { filePath: string; content: string }): Promise<string> {
    try {
      const targetPath = path.resolve(args.filePath);
      // Ensure directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, args.content, 'utf-8');
      return `Successfully wrote ${args.content.length} bytes to ${targetPath}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  }
}
