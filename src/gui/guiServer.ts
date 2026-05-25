import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Agent imports
import { loadConfig, saveConfig, updateConfig } from '../utils/config.js';
import { MemoryManager } from '../core/memory.js';
import { OpenRouterProvider } from '../providers/openrouter.js';
import { OpenAIProvider } from '../providers/openai.js';
import { AnthropicProvider } from '../providers/anthropic.js';
import { GroqProvider } from '../providers/groq.js';
import { BaseProvider } from '../providers/index.js';
import { ToolRegistry } from '../tools/index.js';
import { HexonitAgent } from '../core/agent.js';
import { UserProfileManager } from '../core/profile.js';
import { Logger, LogEvent } from '../utils/logger.js';

// Tools
import { BashTool } from '../tools/builtin/bash.js';
import { FileTool } from '../tools/builtin/file.js';
import { WebSearchTool } from '../tools/builtin/web-search.js';
import { GithubSearchTool } from '../tools/builtin/github.js';
import { FetchUrlTool } from '../tools/builtin/fetch-url.js';
import { CreateTool } from '../tools/builtin/create-tool.js';
import { BrowserTool } from '../tools/builtin/browser.js';
import { BrowserStartTool } from '../tools/builtin/browser-start.js';
import { EditMultipleTool } from '../tools/builtin/edit-multiple.js';
import { SearchCodeTool } from '../tools/builtin/search-code.js';
import { GitTool } from '../tools/builtin/git.js';
import { ProjectContextTool } from '../tools/builtin/project-context.js';
import { RunCommandTool } from '../tools/builtin/run-command.js';
import { ProfileTool } from '../tools/builtin/profile.js';
import { SubagentTool } from '../tools/builtin/subagent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(os.homedir(), '.hexonit', 'sessions');
const MEMORY_FILE = path.join(os.homedir(), '.hexonit', 'memory', 'long-term.json');
const PID_FILE = path.join(os.homedir(), '.hexonit', 'gateway.pid');

const PROVIDER_MAP: Record<string, new (key: string, model: string) => BaseProvider> = {
  openrouter: OpenRouterProvider,
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  groq: GroqProvider,
};

function createAgent(providerName?: string, modelName?: string): HexonitAgent {
  const config = loadConfig();
  const pn = providerName || config.defaultProvider;
  const mn = modelName || config.defaultModel;
  const apiKey = config.keys[pn];

  if (!apiKey) {
    throw new Error(`API key for provider "${pn}" is missing. Please configure it in Settings.`);
  }

  const ProviderClass = PROVIDER_MAP[pn];
  if (!ProviderClass) {
    throw new Error(`Unsupported provider: "${pn}"`);
  }

  const provider: BaseProvider = new ProviderClass(apiKey, mn);
  const profileManager = new UserProfileManager();
  const registry = new ToolRegistry();
  
  registry.register(new BashTool());
  registry.register(new FileTool());
  registry.register(new WebSearchTool());
  registry.register(new GithubSearchTool());
  registry.register(new FetchUrlTool());
  registry.register(new CreateTool(registry));
  registry.register(new BrowserTool());
  registry.register(new BrowserStartTool());
  registry.register(new EditMultipleTool());
  registry.register(new SearchCodeTool());
  registry.register(new GitTool());
  registry.register(new ProjectContextTool());
  registry.register(new RunCommandTool());
  registry.register(new ProfileTool(profileManager));
  
  registry.register(new SubagentTool(async (task) => {
    const child = createAgent(pn, mn);
    child.setModel(mn);
    const result = await child.runForResult(task);
    child.cleanup();
    return result;
  }));

  const agent = new HexonitAgent(provider, registry, mn, profileManager);
  agent.setAutoApprove(true); // Default auto-approve for seamless visual automation
  return agent;
}

export async function startGuiServer(port = 3890): Promise<void> {
  const app = express();
  app.use(express.json());

  // Serve static files from the public folder
  const publicPath = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicPath)) {
    fs.mkdirSync(publicPath, { recursive: true });
  }
  app.use(express.static(publicPath));

  // --- REST API Endpoints ---

  // Get and Update Config
  app.get('/api/config', (req, res) => {
    try {
      const config = loadConfig();
      res.json({ success: true, config });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/config', (req, res) => {
    try {
      const updates = req.body;
      const updated = updateConfig(updates);
      res.json({ success: true, config: updated });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Memory Management
  app.get('/api/memory', (req, res) => {
    try {
      let memories = [];
      if (fs.existsSync(MEMORY_FILE)) {
        memories = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      }
      res.json({ success: true, memories });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/memory', (req, res) => {
    try {
      const { action, memoryId, content, type, tags } = req.body;
      if (!fs.existsSync(MEMORY_FILE)) {
        res.json({ success: true, memories: [] });
        return;
      }
      let memories = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      
      if (action === 'delete') {
        memories = memories.filter((m: any) => m.id !== memoryId);
      } else if (action === 'edit') {
        memories = memories.map((m: any) => {
          if (m.id === memoryId) {
            return { ...m, content, type, tags, timestamp: Date.now() };
          }
          return m;
        });
      } else if (action === 'clear') {
        memories = [];
      }

      fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2), 'utf-8');
      res.json({ success: true, memories });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Session Management
  app.get('/api/sessions', (req, res) => {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        res.json({ success: true, sessions: [] });
        return;
      }
      const files = fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const p = path.join(SESSIONS_DIR, f);
          const stat = fs.statSync(p);
          let data: any = {};
          try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
          return {
            id: data.id || f.replace('session-', '').replace('.json', ''),
            timestamp: data.timestamp || stat.mtimeMs,
            uptime: data.uptime || '?',
            msgCount: data.messages?.length || 0,
            provider: data.provider || 'unknown',
            model: data.model || 'unknown'
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      res.json({ success: true, sessions: files });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/sessions/:id', (req, res) => {
    try {
      const file = path.join(SESSIONS_DIR, `session-${req.params.id}.json`);
      if (!fs.existsSync(file)) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      res.json({ success: true, session: data });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/sessions/:id', (req, res) => {
    try {
      const file = path.join(SESSIONS_DIR, `session-${req.params.id}.json`);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Tools & Skills
  app.get('/api/tools', (req, res) => {
    try {
      const config = loadConfig();
      const registry = new ToolRegistry();
      registry.register(new BashTool());
      registry.register(new FileTool());
      registry.register(new WebSearchTool());
      registry.register(new GithubSearchTool());
      registry.register(new FetchUrlTool());
      registry.register(new BrowserTool());
      registry.register(new BrowserStartTool());
      registry.register(new EditMultipleTool());
      registry.register(new SearchCodeTool());
      registry.register(new GitTool());
      registry.register(new ProjectContextTool());
      registry.register(new RunCommandTool());

      const tools = registry.getAllTools().map(t => ({
        name: t.name,
        description: t.description,
        schema: (t as any).schema || {}
      }));
      res.json({ success: true, tools });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Workflow Recorder & Skill Compiler
  app.post('/api/tools/compile', (req, res) => {
    try {
      const { skillName, description, commands } = req.body;
      const cleanName = skillName.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const toolCode = `import { BaseTool } from '../index.js';
import { execSync } from 'child_process';

export class ${skillName}Tool implements BaseTool {
  name = '${cleanName}';
  description = '${description.replace(/'/g, "\\'")}';

  async execute(): Promise<string> {
    try {
      const results = [];
      ${commands.map((c: string) => `
      results.push('$ ${c}');
      const out${Math.floor(Math.random()*10000)} = execSync('${c.replace(/'/g, "\\'")}', { encoding: 'utf-8' });
      results.push(out${Math.floor(Math.random()*10000)});
      `).join('\n')}
      return results.join('\\n');
    } catch (e: any) {
      return \`Error executing skill: \${e.message}\`;
    }
  }
}`;
      const toolFilePath = path.join(process.cwd(), 'src', 'tools', 'builtin', `${cleanName}.ts`);
      fs.writeFileSync(toolFilePath, toolCode, 'utf-8');
      res.json({ success: true, path: toolFilePath });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Background Gateway Controls (OpenClaw-style)
  app.get('/api/gateway', (req, res) => {
    try {
      const exists = fs.existsSync(PID_FILE);
      let online = false;
      let pid = null;
      if (exists) {
        pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
        try {
          process.kill(parseInt(pid, 10), 0);
          online = true;
        } catch {
          online = false;
        }
      }
      res.json({
        success: true,
        online,
        pid,
        channels: {
          telegram: online, // Gateway monitors all combined
          whatsapp: false,
          discord: false
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/gateway/toggle', (req, res) => {
    try {
      const { start } = req.body;
      const cliPath = path.join(__dirname, 'index.js');
      if (start) {
        if (fs.existsSync(PID_FILE)) {
          fs.unlinkSync(PID_FILE);
        }
        const child = spawn(process.execPath, [cliPath, 'chat'], {
          detached: true,
          stdio: 'ignore',
          env: { ...process.env, HEXONIT_GATEWAY: '1' }
        });
        child.unref();
        fs.writeFileSync(PID_FILE, String(child.pid), 'utf-8');
        res.json({ success: true, online: true, pid: child.pid });
      } else {
        if (fs.existsSync(PID_FILE)) {
          const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
          try { process.kill(pid, 'SIGTERM'); } catch {}
          fs.unlinkSync(PID_FILE);
        }
        res.json({ success: true, online: false });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Telemetry Telemetry (Uptime, Ram, CPU)
  app.get('/api/telemetry', (req, res) => {
    try {
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const usageRam = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
      const uptime = Math.floor(os.uptime());
      res.json({
        success: true,
        telemetry: {
          platform: `${os.type()} ${os.release()}`,
          cpu: os.cpus()[0]?.model || 'Generic CPU',
          cores: os.cpus().length,
          ram: `${(freeMem / 1e9).toFixed(2)} GB Free / ${(totalMem / 1e9).toFixed(2)} GB Total (${usageRam}% used)`,
          uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Default Page routing to SPA index
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  // Create Server
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // WebSockets Chat & Logging Pipeline
  wss.on('connection', (ws: WebSocket) => {
    let currentAgent: HexonitAgent | null = null;

    const logListener = (event: LogEvent) => {
      ws.send(JSON.stringify({ type: 'telemetry', data: event }));
    };

    // Attach listener to catch any system, bash, or tool log and stream it to GUI
    Logger.addListener(logListener);

    ws.on('message', async (message: string) => {
      try {
        const payload = JSON.parse(message);
        
        if (payload.action === 'chat') {
          const { text, provider, model } = payload;
          
          ws.send(JSON.stringify({ type: 'agent-thinking', text: 'Spawning agent connection...' }));
          currentAgent = createAgent(provider, model);

          // Listen for stream delta elements
          if (currentAgent.supportsStreaming()) {
            await currentAgent.runStream(text);
          } else {
            await currentAgent.run(text);
          }

          ws.send(JSON.stringify({ type: 'agent-done' }));
        } else if (payload.action === 'abort') {
          if (currentAgent) {
            currentAgent.abort();
            ws.send(JSON.stringify({ type: 'agent-aborted', text: 'Processing cancelled.' }));
          }
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', text: err.message }));
      }
    });

    ws.on('close', () => {
      Logger.removeListener(logListener);
      if (currentAgent) {
        try { currentAgent.cleanup(); } catch {}
      }
    });
  });

  // Listen and open browser
  server.listen(port, () => {
    console.log(Logger.renderInline(`\n***Hexonit Desktop Command Center*** is running locally on port \`http://localhost:${port}\`!`));
    console.log(Logger.renderInline(`Press ***Ctrl+C*** to terminate the server.`));
    
    // Automatically boot browser in a cross-platform way
    try {
      const url = `http://localhost:${port}`;
      if (process.platform === 'win32') {
        spawn('cmd', ['/c', 'start', url], { detached: true, stdio: 'ignore' }).unref();
      } else if (process.platform === 'darwin') {
        spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
      }
    } catch {}
  });
}
