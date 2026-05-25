import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from '../index.js';

const execAsync = promisify(exec);

export class BashTool implements Tool {
  name = 'execute_bash';
  description = 'Executes a bash/shell command on the local machine and returns the output. Use this to navigate directories, list files, install packages, and execute scripts.';
  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to parameterize and execute.',
      },
    },
    required: ['command'],
  };

  async execute(args: { command: string }): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(args.command);
      if (stderr && stderr.trim().length > 0) {
        return `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
      }
      return stdout || 'Command executed successfully with no output.';
    } catch (error: any) {
      return `Command failed: ${error.message}`;
    }
  }
}
