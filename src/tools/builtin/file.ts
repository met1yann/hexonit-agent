import fs from 'fs/promises';
import path from 'path';
import { Tool } from '../index.js';

export class FileTool implements Tool {
  name = 'file';
  description = 'Read, write, list directory contents, or get file info. Use action="read" to read a file, action="write" to write/create a file, action="list" to list a directory, action="info" for file metadata.';
  parameters = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'write', 'list', 'info'], description: 'The file operation to perform.' },
      filePath: { type: 'string', description: 'Path to the file (required for read/write/info).' },
      directoryPath: { type: 'string', description: 'Path to the directory (required for list).' },
      content: { type: 'string', description: 'Content to write (required for write).' },
    },
    required: ['action'],
  };

  async execute(args: { action: string; filePath?: string; directoryPath?: string; content?: string }): Promise<string> {
    try {
      if (args.action === 'read') {
        if (!args.filePath) return 'Error: filePath is required for read action.';
        const targetPath = path.resolve(args.filePath);
        const stat = await fs.stat(targetPath);
        const MAX_SIZE = 1024 * 1024;
        if (stat.size > MAX_SIZE) {
          return `Error: File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: 1MB. Use execute_bash to read in chunks.`;
        }
        return await fs.readFile(targetPath, 'utf-8');
      }

      if (args.action === 'write') {
        if (!args.filePath) return 'Error: filePath is required for write action.';
        if (args.content === undefined) return 'Error: content is required for write action.';
        const targetPath = path.resolve(args.filePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, args.content, 'utf-8');
        return `Successfully wrote ${args.content.length} bytes to ${targetPath}`;
      }

      if (args.action === 'list') {
        const dirPath = args.directoryPath || '.';
        const targetPath = path.resolve(process.cwd(), dirPath);
        const items = await fs.readdir(targetPath, { withFileTypes: true });
        const files = items.filter(i => i.isFile()).map(i => `[FILE] ${i.name}`);
        const dirs = items.filter(i => i.isDirectory()).map(i => `[DIR]  ${i.name}/`);
        const tree = [...dirs, ...files];
        if (tree.length === 0) return `Directory is empty: ${targetPath}`;
        return tree.join('\n');
      }

      if (args.action === 'info') {
        if (!args.filePath) return 'Error: filePath is required for info action.';
        const targetPath = path.resolve(args.filePath);
        const stat = await fs.stat(targetPath);
        return [
          `Path: ${targetPath}`,
          `Size: ${(stat.size / 1024).toFixed(1)} KB`,
          `Created: ${stat.birthtime.toISOString()}`,
          `Modified: ${stat.mtime.toISOString()}`,
          `Is File: ${stat.isFile()}`,
          `Is Directory: ${stat.isDirectory()}`,
        ].join('\n');
      }

      return `Error: Unknown action "${args.action}". Use read, write, list, or info.`;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }
}
