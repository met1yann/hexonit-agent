import { Tool } from '../index.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export class RunCommandTool implements Tool {
  name = 'run_command';
  description = 'Find and run project commands (test, lint, build, typecheck, etc.). Automatically detects the right command from package.json or other project configs. Returns full output with exit code.';
  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: ['test', 'lint', 'build', 'typecheck', 'format', 'custom'],
        description: 'Type of command to run',
      },
      customScript: { type: 'string', description: 'Custom npm script name (when command=custom)' },
      path: { type: 'string', description: 'Project path (default: current dir)' },
      args: { type: 'string', description: 'Additional CLI arguments to pass' },
    },
    required: ['command'],
  };

  async execute(args: { command: string; customScript?: string; path?: string; args?: string }): Promise<string> {
    const projectPath = args.path || process.cwd();
    let scriptName = '';

    if (args.command === 'custom' && args.customScript) {
      scriptName = args.customScript;
    } else {
      const pkgPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          const scripts = pkg.scripts || {};
          const commandMap: Record<string, string[]> = {
            test: ['test', 'test:run', 'jest', 'vitest', 'mocha'],
            lint: ['lint', 'eslint', 'tslint'],
            build: ['build', 'compile'],
            typecheck: ['typecheck', 'type-check', 'tsc:check', 'typescript:check'],
            format: ['format', 'prettier'],
          };
          const candidates = commandMap[args.command] || [];
          scriptName = candidates.find((s) => scripts[s]) || '';
        } catch {}
      }
    }

    if (!scriptName) {
      return `No script found for "${args.command}" in ${projectPath}`;
    }

    const fullCmd = `npm run ${scriptName}${args.args ? ' ' + args.args : ''}`;
    try {
      const output = execSync(fullCmd, { cwd: projectPath, encoding: 'utf-8', maxBuffer: 1048576, timeout: 120000 });
      return `Exit code: 0\n${output.slice(0, 10000)}`;
    } catch (err: any) {
      const stderr = err.stderr || '';
      const stdout = err.stdout || '';
      return `Exit code: ${err.status || 1}\n${(stdout + '\n' + stderr).slice(0, 10000)}`;
    }
  }
}
