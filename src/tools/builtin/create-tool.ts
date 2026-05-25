import { Tool, ToolRegistry } from '../index.js';

export class CreateTool implements Tool {
  name = 'create_tool';
  description = 'Dynamically creates and registers a new tool at runtime. Use this when you need a capability that no existing tool provides. After creation, the new tool can be called immediately in the next iteration. Provide a clear name, description, parameter schema, and JavaScript async function body. The function receives `args` (the tool call arguments). Import Node.js modules with `await import("module")`. Return a string result.';
  parameters = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Unique tool name in snake_case (e.g. "copy_files", "analyze_log").',
      },
      description: {
        type: 'string',
        description: 'Clear description of what the tool does, for the AI to understand when to use it.',
      },
      code: {
        type: 'string',
        description: 'JavaScript async function body. `args` contains the parameters. Use `await import("fs/promises")` for file I/O. Must return a string. Example: const fs = await import("fs/promises"); await fs.writeFile(args.path, args.content); return `Written ${args.path}`;',
      },
      parameters: {
        type: 'object',
        description: 'JSON Schema for tool parameters. Example: {"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}',
      },
    },
    required: ['name', 'description', 'code'],
  };

  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  async execute(args: { name: string; description: string; code: string; parameters?: string }): Promise<string> {
    let params: Tool['parameters'] = {
      type: 'object',
      properties: {},
      required: [],
    };

    if (args.parameters) {
      try {
        const parsed = typeof args.parameters === 'string' ? JSON.parse(args.parameters) : args.parameters;
        if (parsed && typeof parsed === 'object') {
          params = parsed as Tool['parameters'];
        }
      } catch {
        return `Error: Invalid parameters JSON schema. Please provide valid JSON.`;
      }
    }

    try {
      this.registry.registerDynamic(args.name, args.description, args.code, params);
      return `Tool "${args.name}" has been created and registered. You can now use it in the next iteration. Description: ${args.description}`;
    } catch (error: any) {
      return `Error creating tool "${args.name}": ${error.message}`;
    }
  }
}
