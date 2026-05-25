import { Tool } from '../index.js';
import { execSync } from 'child_process';

export class GitTool implements Tool {
  name = 'git';
  description = 'Execute git operations: status, diff, log, add, commit, branch, checkout, merge, push, pull, stash, reset, init, remote. Returns command output.';
  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: ['status', 'diff', 'log', 'add', 'commit', 'branch', 'checkout', 'merge', 'push', 'pull', 'stash', 'reset', 'init', 'remote', 'clone', 'fetch', 'rebase', 'tag'],
        description: 'Git command to run',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional arguments for the git command',
      },
      message: { type: 'string', description: 'Commit message (used with commit command)' },
      path: { type: 'string', description: 'Git repository path (default: current dir)' },
    },
    required: ['command'],
  };

  async execute(args: { command: string; args?: string[]; message?: string; path?: string }): Promise<string> {
    const repoPath = args.path || process.cwd();
    let cmdArgs = args.args || [];

    switch (args.command) {
      case 'commit':
        if (args.message) {
          cmdArgs = ['-m', `"${args.message.replace(/"/g, '\\"')}"`, ...cmdArgs];
        }
        break;
      case 'log':
        if (cmdArgs.length === 0) cmdArgs = ['--oneline', '-10'];
        break;
      case 'diff':
        if (cmdArgs.length === 0) cmdArgs = ['--stat'];
        break;
      case 'add':
        if (cmdArgs.length === 0) cmdArgs = ['.'];
        break;
    }

    const cmd = `git -C "${repoPath}" ${args.command} ${cmdArgs.join(' ')}`;
    try {
      const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 524288, timeout: 30000 });
      return output || '(empty output)';
    } catch (err: any) {
      return err.stdout ? err.stdout : `Git error: ${err.message}`;
    }
  }
}
