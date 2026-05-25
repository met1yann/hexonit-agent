import { Tool } from '../index.js';
import fs from 'fs';
import path from 'path';

export class ProjectContextTool implements Tool {
  name = 'project_context';
  description = 'Analyze a project directory and return its structure, dependencies, config files, and key metadata. Useful for understanding codebases before making changes.';
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project directory path (default: current dir)' },
      maxDepth: { type: 'number', description: 'Max directory depth (default: 3)' },
    },
    required: [],
  };

  async execute(args: { path?: string; maxDepth?: number }): Promise<string> {
    const root = args.path || process.cwd();
    const maxDepth = args.maxDepth ?? 3;

    if (!fs.existsSync(root)) return `Directory not found: ${root}`;

    const parts: string[] = [];
    parts.push(`Project: ${root}`);

    const readJSON = (file: string): string | null => {
      const fp = path.join(root, file);
      try { return fs.readFileSync(fp, 'utf-8'); } catch { return null; }
    };

    const pkg = readJSON('package.json');
    if (pkg) {
      try {
        const p = JSON.parse(pkg);
        parts.push(`\n--- package.json ---`);
        parts.push(`Name: ${p.name || '-'}  Version: ${p.version || '-'}`);
        if (p.scripts) parts.push(`Scripts: ${Object.keys(p.scripts).join(', ')}`);
        if (p.dependencies) parts.push(`Dependencies: ${Object.keys(p.dependencies).join(', ')}`);
        if (p.devDependencies) parts.push(`DevDeps: ${Object.keys(p.devDependencies).join(', ')}`);
      } catch {}
    }

    for (const f of ['tsconfig.json', 'Cargo.toml', 'pyproject.toml', 'go.mod', 'Gemfile', 'composer.json', '.gitignore', '.env.example', 'Dockerfile', 'Makefile', 'README.md']) {
      const content = readJSON(f);
      if (content) {
        const lines = content.split('\n');
        parts.push(`\n--- ${f} ---`);
        parts.push(lines.slice(0, 20).join('\n'));
        if (lines.length > 20) parts.push(`... (${lines.length - 20} more lines)`);
      }
    }

    const dirTree: string[] = [];
    const walk = (dir: string, depth: number): void => {
      if (depth > maxDepth) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'target' || e.name === '.git' || e.name === '__pycache__' || e.name === 'vendor') continue;
          const rel = path.relative(root, path.join(dir, e.name));
          if (e.isDirectory()) {
            dirTree.push(`${'  '.repeat(depth)}[${e.name}/]`);
            walk(path.join(dir, e.name), depth + 1);
          } else {
            dirTree.push(`${'  '.repeat(depth)}${e.name}`);
          }
        }
      } catch {}
    };
    walk(root, 0);
    if (dirTree.length > 0) {
      parts.push(`\n--- Directory Structure (depth: ${maxDepth}) ---`);
      parts.push(dirTree.join('\n'));
    }

    return parts.join('\n');
  }
}
