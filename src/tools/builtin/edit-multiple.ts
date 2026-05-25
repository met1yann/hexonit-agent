import { Tool } from '../index.js';
import fs from 'fs';

interface EditOperation {
  file: string;
  old: string;
  new: string;
  regex?: boolean;
}

export class EditMultipleTool implements Tool {
  name = 'edit_multiple';
  description = 'Apply multiple search-and-replace edits across files in one call. Each operation replaces the first occurrence of `old` with `new` in the specified file. If `regex` is true, `old` is treated as a RegExp pattern. Returns a summary of changes.';
  parameters = {
    type: 'object',
    properties: {
      operations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File path (absolute or relative to workspace)' },
            old: { type: 'string', description: 'Text to find (or regex pattern if regex=true)' },
            new: { type: 'string', description: 'Replacement text' },
            regex: { type: 'boolean', description: 'Treat old as regex pattern' },
          },
          required: ['file', 'old', 'new'],
        },
      },
    },
    required: ['operations'],
  };

  async execute(args: { operations: EditOperation[] }): Promise<string> {
    const results: string[] = [];
    for (const op of args.operations) {
      try {
        if (!fs.existsSync(op.file)) { results.push(`SKIP ${op.file}: file not found`); continue; }
        let content = fs.readFileSync(op.file, 'utf-8');
        let count = 0;
        if (op.regex) {
          const re = new RegExp(op.old, 'g');
          const match = content.match(re);
          count = match ? match.length : 0;
          content = content.replace(re, op.new);
        } else {
          const idx = content.indexOf(op.old);
          if (idx === -1) { results.push(`NOCHANGE ${op.file}: pattern not found`); continue; }
          content = content.slice(0, idx) + op.new + content.slice(idx + op.old.length);
          count = 1;
        }
        fs.writeFileSync(op.file, content, 'utf-8');
        results.push(`OK ${op.file}: ${count} replacement${count !== 1 ? 's' : ''}`);
      } catch (err: any) {
        results.push(`ERROR ${op.file}: ${err.message}`);
      }
    }
    return results.join('\n');
  }
}
