export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute(args: any): Promise<string>;
  timeout?: number;
  sandboxSafe?: boolean;
}

export type PermissionCheck = (toolName: string, args: any) => Promise<boolean>;

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private permissionCheck: PermissionCheck | null = null;

  setPermissionCheck(cb: PermissionCheck | null): void {
    this.permissionCheck = cb;
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  registerDynamic(name: string, description: string, code: string, parameters?: Tool['parameters']): void {
    const tool: Tool = {
      name,
      description,
      parameters: parameters || { type: 'object', properties: {}, required: [] },
      async execute(execArgs: any): Promise<string> {
        try {
          const fn = new Function('args', code);
          const result = await fn(execArgs);
          return result == null ? 'Done.' : String(result);
        } catch (error: any) {
          return `Error executing dynamic tool "${name}": ${error.message}`;
        }
      },
    };
    this.tools.set(name, tool);
  }

  async executeTool(name: string, args: any): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Tool "${name}" is not registered. Available: ${Array.from(this.tools.keys()).join(', ')}. Use create_tool to create it first.`;
    }
    if (this.permissionCheck) {
      const allowed = await this.permissionCheck(name, args);
      if (!allowed) return `[USER CANCELLED] Tool "${name}" was skipped.`;
    }
    const timeoutMs = tool.timeout ?? 60000;
    try {
      const result = await Promise.race([
        tool.execute(args),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool "${name}" timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    } catch (error: any) {
      return `Error executing "${name}": ${error.message}`;
    }
  }
}
