import { Tool } from '../index.js';
import fs from 'fs';
import path from 'path';

export class SearchCodeTool implements Tool {
  name = 'search_code';
  description = 'Search codebase for a pattern using glob + grep. Returns matching file paths, line numbers, and context snippets. Supports regex patterns and file type filtering.';
  parameters = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex supported)' },
      include: { type: 'string', description: 'File glob pattern, e.g. "*.ts", "*.{ts,tsx}"' },
      path: { type: 'string', description: 'Directory to search (default: workspace root or current dir)' },
      maxResults: { type: 'number', description: 'Max results to return (default 20)' },
      contextLines: { type: 'number', description: 'Lines of context around match (default 1)' },
    },
    required: ['pattern'],
  };

  async execute(args: { pattern: string; include?: string; path?: string; maxResults?: number; contextLines?: number }): Promise<string> {
    const searchDir = args.path || process.cwd();
    const maxResults = args.maxResults || 20;
    const context = args.contextLines ?? 1;

    if (!fs.existsSync(searchDir)) return `Directory not found: ${searchDir}`;

    const results: string[] = [];
    const walkDir = (dir: string): void => {
      if (results.length >= maxResults) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) return;
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) { walkDir(full); continue; }
          if (args.include) {
            const globMatch = (name: string, pattern: string): boolean => {
              const reStr = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\{([^}]+)\}/g, '($1)').replace(/,/g, '|');
              return new RegExp(`^${reStr}$`).test(name);
            };
            if (!globMatch(entry.name, args.include)) continue;
          }
          try {
            const content = fs.readFileSync(full, 'utf-8');
            const lines = content.split('\n');
            const re = new RegExp(args.pattern, 'gi');
            for (let i = 0; i < lines.length; i++) {
              if (re.test(lines[i])) {
                const start = Math.max(0, i - context);
                const end = Math.min(lines.length - 1, i + context);
                const snippet = lines.slice(start, end + 1).map((l, idx) => {
                  const lineNum = start + idx + 1;
                  const marker = (start + idx) === i ? '>' : ' ';
                  return `  ${marker} ${String(lineNum).padStart(4)}: ${l.slice(0, 200)}`;
                }).join('\n');
                results.push(`${full}:${i + 1}\n${snippet}`);
                if (results.length >= maxResults) return;
              }
            }
          } catch {}
        }
      } catch {}
    };

    walkDir(searchDir);
    if (results.length === 0) return `No matches for "${args.pattern}"`;
    return results.join('\n---\n');
  }
}
