import { Tool } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ListDirTool implements Tool {
  name = 'list_dir';
  description = 'Lists all files and directories inside a specific folder relative to the current working environment. Gives you an overview of the file tree.';
  parameters = {
    type: 'object',
    properties: {
      directoryPath: { type: 'string', description: 'The folder path to read. Use "." for current root.' }
    },
    required: ['directoryPath']
  };

  async execute(args: { directoryPath: string }): Promise<string> {
    try {
      const targetPath = path.resolve(process.cwd(), args.directoryPath);
      const items = await fs.readdir(targetPath, { withFileTypes: true });

      const files = items.filter(i => i.isFile()).map(i => `📄 ${i.name}`);
      const dirs = items.filter(i => i.isDirectory()).map(i => `📁 ${i.name}/`);

      const tree = [...dirs, ...files];

      if (tree.length === 0) return `Directory is empty: ${targetPath}`;
      return `Contents of ${targetPath}:\n` + tree.join('\n');
    } catch (error: any) {
      return `Failed to list directory: ${error.message}`;
    }
  }
}
