import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { Tool } from '../index.js';

const execAsync = promisify(exec);

export class BashTool implements Tool {
  name = 'execute_bash';
  description = 'Executes a shell command or gets system info. Pass a "command" to run a shell command, or set action="system_info" to get OS/CPU/memory details.';
  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
      },
      action: {
        type: 'string',
        enum: ['system_info'],
        description: 'Get system information instead of running a command.',
      },
    },
  };

  async execute(args: { command?: string; action?: string }): Promise<string> {
    if (args.action === 'system_info') {
      try {
        const info = {
          osType: os.type(),
          osPlatform: os.platform(),
          osRelease: os.release(),
          architecture: os.arch(),
          cpus: os.cpus().length,
          cpuModel: os.cpus()[0].model,
          totalMemoryGb: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2),
          freeMemoryGb: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2),
          uptimeHours: (os.uptime() / 3600).toFixed(2),
          homedir: os.homedir(),
          username: os.userInfo().username,
        };
        return JSON.stringify(info, null, 2);
      } catch (error: any) {
        return `Failed to fetch system metrics: ${error.message}`;
      }
    }

    if (!args.command) return 'Error: Either provide a "command" to execute or set action="system_info".';

    try {
      const { stdout, stderr } = await execAsync(args.command, { timeout: 30000, maxBuffer: 512 * 1024 });
      if (stderr && stderr.trim().length > 0) {
        return `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
      }
      return stdout || 'Command executed successfully with no output.';
    } catch (error: any) {
      return `Command failed: ${error.message}`;
    }
  }
}
