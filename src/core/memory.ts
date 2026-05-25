import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Memory {
  id: string;
  type: 'factual' | 'episodic' | 'procedural';
  content: string;
  timestamp: number;
  tags: string[];
  importance: number;
  accessCount: number;
}

const MEMORY_DIR = path.join(os.homedir(), '.hexonit', 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'long-term.json');
const MAX_SHORT_TERM = 50;

export class MemoryManager {
  private longTerm: Memory[] = [];
  private shortTerm: Memory[] = [];

  constructor() {
    this.loadLongTerm();
  }

  private loadLongTerm(): void {
    try {
      if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
      if (fs.existsSync(MEMORY_FILE)) {
        this.longTerm = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      }
    } catch { this.longTerm = []; }
  }

  private saveLongTerm(): void {
    try {
      if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.longTerm, null, 2), 'utf-8');
    } catch {}
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  remember(type: Memory['type'], content: string, tags: string[] = [], importance: number = 0.5): void {
    const memory: Memory = {
      id: this.generateId(),
      type,
      content,
      timestamp: Date.now(),
      tags,
      importance: Math.max(0, Math.min(1, importance)),
      accessCount: 0,
    };

    if (importance > 0.7) {
      this.longTerm.push(memory);
      this.saveLongTerm();
    } else {
      this.shortTerm.push(memory);
      if (this.shortTerm.length > MAX_SHORT_TERM) {
        this.shortTerm.shift();
      }
    }
  }

  recall(query: string, limit: number = 10): Memory[] {
    const q = query.toLowerCase();
    const all = [...this.shortTerm, ...this.longTerm];
    const scored = all.map(m => {
      let score = 0;
      score += m.content.toLowerCase().includes(q) ? 1 : 0;
      score += m.tags.some(t => t.toLowerCase().includes(q)) ? 0.5 : 0;
      score += m.importance * 0.3;
      return { memory: m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit).map(s => {
      s.memory.accessCount++;
      return s.memory;
    });
    this.saveLongTerm();
    return top;
  }

  getRecent(knowledgeCount: number = 20): string {
    const recent = [...this.shortTerm, ...this.longTerm]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, knowledgeCount);

    if (recent.length === 0) return '';

    return recent.map(m => {
      const date = new Date(m.timestamp).toLocaleString();
      const tagStr = m.tags.length ? ` [${m.tags.join(', ')}]` : '';
      return `[${m.type}] (${date})${tagStr} ${m.content}`;
    }).join('\n');
  }

  consolidate(): void {
    const promoted = this.shortTerm.filter(m => m.importance > 0.7);
    for (const m of promoted) {
      const exists = this.longTerm.some(l => l.content === m.content);
      if (!exists) {
        this.longTerm.push(m);
      }
    }
    this.shortTerm = this.shortTerm.filter(m => m.importance <= 0.7);
    this.saveLongTerm();
  }

  forget(tags: string[]): void {
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    this.longTerm = this.longTerm.filter(m => !m.tags.some(t => tagSet.has(t.toLowerCase())));
    this.shortTerm = this.shortTerm.filter(m => !m.tags.some(t => tagSet.has(t.toLowerCase())));
    this.saveLongTerm();
  }

  wipeAll(): void {
    this.longTerm = [];
    this.shortTerm = [];
    try { if (fs.existsSync(MEMORY_FILE)) fs.unlinkSync(MEMORY_FILE); } catch {}
  }

  getStats(): { shortTerm: number; longTerm: number; total: number } {
    return {
      shortTerm: this.shortTerm.length,
      longTerm: this.longTerm.length,
      total: this.shortTerm.length + this.longTerm.length,
    };
  }
}
