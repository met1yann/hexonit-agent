import { Tool } from '../index.js';

export type SubagentRunner = (task: string) => Promise<string>;

export class SubagentTool implements Tool {
  name = 'spawn_subagent';
  description = 'Spawn a child AI subagent to complete a task independently. The subagent has its own conversation loop and can use tools. Returns the subagent\'s final response. Use for complex multi-step tasks that can run in parallel or need focused attention.';
  parameters = {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'The task description for the subagent to complete' },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of tool names to restrict (default: all tools). Example: ["execute_bash", "read_file", "write_file", "search_code", "git"]',
      },
    },
    required: ['task'],
  };

  private runner: SubagentRunner;

  constructor(runner: SubagentRunner) {
    this.runner = runner;
  }

  async execute(args: { task: string; tools?: string[] }): Promise<string> {
    return await this.runner(args.task);
  }
}
