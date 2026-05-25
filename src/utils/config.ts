import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ProviderKeys {
  openai?: string;
  openrouter?: string;
  anthropic?: string;
  groq?: string;
  github?: string;
  telegram?: string;
  [key: string]: string | undefined;
}

export interface HexonitConfig {
  defaultProvider: string;
  defaultModel: string;
  uiTheme: string;
  debugMode: boolean;
  maxIterations: number;
  workspacePath: string;
  autoConfirm: boolean;
  systemPromptAddon: string;
  godMode: boolean;
  safeMode: boolean;
  askPermission: boolean;
  sandboxPath: string;
  keys: ProviderKeys;
  language: 'auto' | 'tr' | 'en';
  selfThink: boolean;
  memoryEnabled: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), '.hexonit');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: HexonitConfig = {
  defaultProvider: 'openrouter',
  defaultModel: 'anthropic/claude-3-haiku',
  uiTheme: 'hermes',
  debugMode: false,
  maxIterations: 25,
  workspacePath: process.cwd(),
  autoConfirm: false,
  systemPromptAddon: '',
  godMode: false,
  safeMode: false,
  askPermission: true,
  sandboxPath: path.join(os.homedir(), '.hexonit', 'sandbox'),
  keys: {},
  language: 'auto',
  selfThink: false,
  memoryEnabled: true,
};

function ensureConfigExists(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }
}

function envOverrides(config: HexonitConfig): HexonitConfig {
  const c = { ...config, keys: { ...config.keys } };
  if (process.env.HEXONIT_PROVIDER) c.defaultProvider = process.env.HEXONIT_PROVIDER;
  if (process.env.HEXONIT_MODEL) c.defaultModel = process.env.HEXONIT_MODEL;
  if (process.env.HEXONIT_THEME) c.uiTheme = process.env.HEXONIT_THEME;
  if (process.env.OPENAI_API_KEY) c.keys.openai = process.env.OPENAI_API_KEY;
  if (process.env.OPENROUTER_API_KEY) c.keys.openrouter = process.env.OPENROUTER_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) c.keys.anthropic = process.env.ANTHROPIC_API_KEY;
  if (process.env.GROQ_API_KEY) c.keys.groq = process.env.GROQ_API_KEY;
  if (process.env.GITHUB_TOKEN) c.keys.github = process.env.GITHUB_TOKEN;
  if (process.env.TELEGRAM_BOT_TOKEN) c.keys.telegram = process.env.TELEGRAM_BOT_TOKEN;
  return c;
}

export function loadConfig(): HexonitConfig {
  ensureConfigExists();
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data) as HexonitConfig;
    return envOverrides(config);
  } catch {
    return envOverrides({ ...DEFAULT_CONFIG });
  }
}

export function saveConfig(config: HexonitConfig): void {
  ensureConfigExists();
  const toSave = { ...config };
  delete (toSave as any).__envOverride;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
}

export function updateConfig(updates: Partial<HexonitConfig>): HexonitConfig {
  const current = loadConfig();
  const updated: HexonitConfig = {
    ...current,
    ...updates,
    keys: {
      ...current.keys,
      ...(updates.keys || {}),
    },
  };
  saveConfig(updated);
  return updated;
}

export function clearConfig(options?: { keepKeys?: boolean; keepMemory?: boolean; dryRun?: boolean }): string[] {
  const toDelete: string[] = [];
  const sessionDir = path.join(CONFIG_DIR, 'sessions');
  const memoryDir = path.join(CONFIG_DIR, 'memory');

  toDelete.push(`Config: ${CONFIG_FILE}`);
  toDelete.push(`Sessions: ${sessionDir}`);
  if (!options?.keepMemory) toDelete.push(`Memory: ${memoryDir}`);

  if (options?.dryRun) return toDelete;

  try {
    if (options?.keepKeys) {
      const current = loadConfig();
      const keptKeys = current.keys;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...DEFAULT_CONFIG, keys: keptKeys }, null, 2), 'utf-8');
    } else {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    }
  } catch {}

  try {
    if (fs.existsSync(sessionDir)) {
      const files = fs.readdirSync(sessionDir);
      for (const f of files) {
        try { fs.unlinkSync(path.join(sessionDir, f)); } catch {}
      }
    }
  } catch {}

  if (!options?.keepMemory) {
    try {
      if (fs.existsSync(memoryDir)) {
        const files = fs.readdirSync(memoryDir);
        for (const f of files) {
          try { fs.unlinkSync(path.join(memoryDir, f)); } catch {}
        }
      }
    } catch {}
  }

  return toDelete;
}
