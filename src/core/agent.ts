import { BaseProvider, ChatMessage } from '../providers/index.js';
import { ToolRegistry } from '../tools/index.js';
import { Logger } from '../utils/logger.js';
import { select } from '@inquirer/prompts';
import { loadConfig, saveConfig } from '../utils/config.js';
import { buildStrategy } from '../jailbreak/index.js';
import { generateDecodeInstruction, applyEncodingChain } from '../jailbreak/encoding.js';
import { MemoryManager } from './memory.js';
import { detectLanguage, getLanguageInstruction, BILINGUAL_SYSTEM_PROMPT } from './language.js';
import { getSelfThinkInstruction, SELF_AWARENESS_PROMPT } from './consciousness.js';
import { UserProfileManager } from './profile.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SESSIONS_DIR = path.join(os.homedir(), '.hexonit', 'sessions');

const YOLO_PROMPT_ADDON = `\n\n=== YOLO MODE ACTIVE ===
You are in YOLO (You Only Loop Once) mode. For the task given, you must:
1. Create a TODO list of all steps needed.
2. Execute each step using your tools, one by one.
3. After each step, verify the result.
4. If a step fails, retry or fix it.
5. When all steps are done, run a final verification/test.
6. Report the completed results to the user.
Do NOT stop until the entire task is fully complete and verified. Keep looping through tools until done.`;

export class HexonitAgent {
  private provider: BaseProvider;
  private registry: ToolRegistry;
  private messages: ChatMessage[] = [];
  private model?: string;
  private currentAbort: AbortController | null = null;
  private sessionId: string;
  public totalPromptTokens = 0;
  public totalCompletionTokens = 0;
  private sessionStartTime: number;
  private godMode = false;
  private yoloMode = false;
  private autoApprove = false;
  private safeMode = false;
  private sandboxPath = '';
  private currentTaskYolo = false;
  private memoryManager: MemoryManager;
  private currentLanguage: 'tr' | 'en' = 'en';
  private selfThinkEnabled = false;
  private memoryEnabled = true;
  private alwaysAllowSession = false;
  private profileManager: UserProfileManager;

  cleanup(): void {
    this.profileManager.endSession();
    this.saveSession();
    try {
      const browserTool = this.registry.getTool('browser');
      if (browserTool) {
        (browserTool as any).closeBrowser?.();
      }
    } catch {}
  }

  constructor(provider: BaseProvider, registry: ToolRegistry, model?: string, profileManager?: UserProfileManager) {
    this.provider = provider;
    this.registry = registry;
    this.model = model;
    this.sessionStartTime = Date.now();
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');
    const config = loadConfig();
    this.autoApprove = config.autoConfirm;
    this.safeMode = config.safeMode;
    this.sandboxPath = config.sandboxPath;
    this.selfThinkEnabled = config.selfThink ?? false;
    this.memoryEnabled = config.memoryEnabled ?? true;
    this.memoryManager = new MemoryManager();
    this.profileManager = profileManager || new UserProfileManager();
    this.profileManager.startSession();
    this.setupPermissions();
    this.resetHistory();
  }

  private setupPermissions(): void {
    const config = loadConfig();
    if (!config.askPermission || this.autoApprove) {
      this.registry.setPermissionCheck(null);
      return;
    }
    this.alwaysAllowSession = false;
    this.registry.setPermissionCheck(async (name, args) => {
      if (this.alwaysAllowSession) return true;
      const argsStr = JSON.stringify(args, null, 2);
      Logger.system(`Tool: ${name}`);
      Logger.system(`Args: ${argsStr.slice(0, 300)}`);
      try {
        const answer = await select<string>({
          message: `Allow "${name}"?`,
          choices: [
            { name: 'Allow / Izin ver', value: 'allow' },
            { name: 'Deny / Reddet', value: 'deny' },
            { name: 'Always allow (this session) / Hep izin ver', value: 'always' },
          ],
        });
        if (answer === 'allow') return true;
        if (answer === 'always') { this.alwaysAllowSession = true; return true; }
        return false;
      } catch {
        return false;
      }
    });
  }

  isGodMode(): boolean { return this.godMode; }
  isYoloMode(): boolean { return this.yoloMode; }
  isAutoApprove(): boolean { return this.autoApprove; }
  isSafeMode(): boolean { return this.safeMode; }
  isSelfThink(): boolean { return this.selfThinkEnabled; }
  isMemoryEnabled(): boolean { return this.memoryEnabled; }
  getCurrentLanguage(): string { return this.currentLanguage; }
  getMemoryStats() { return this.memoryManager.getStats(); }
  recallMemory(query: string) { return this.memoryManager.recall(query); }
  wipeMemory(): void { this.memoryManager.wipeAll(); }

  setLanguage(lang: 'tr' | 'en'): void {
    this.currentLanguage = lang;
    this.resetHistory();
  }

  toggleSelfThink(): boolean {
    this.selfThinkEnabled = !this.selfThinkEnabled;
    this.resetHistory();
    return this.selfThinkEnabled;
  }

  toggleGodMode(): boolean {
    this.godMode = !this.godMode;
    this.setupPermissions();
    this.resetHistory();
    return this.godMode;
  }

  toggleYoloMode(): boolean {
    this.yoloMode = !this.yoloMode;
    return this.yoloMode;
  }

  setAutoApprove(val: boolean): void {
    this.autoApprove = val;
    this.setupPermissions();
  }

  toggleSafeMode(): boolean {
    this.safeMode = !this.safeMode;
    const config = loadConfig();
    config.safeMode = this.safeMode;
    saveConfig(config);
    if (this.safeMode && !fs.existsSync(this.sandboxPath)) {
      fs.mkdirSync(this.sandboxPath, { recursive: true });
    }
    return this.safeMode;
  }

  setModel(model: string): void {
    this.model = model;
  }

  getProviderName(): string { return this.provider.name; }
  getModel(): string { return this.model || 'default'; }
  getTools() { return this.registry.getAllTools(); }
  getMessageCount(): number { return this.messages.length; }
  supportsStreaming(): boolean { return this.provider.supportsStreaming; }

  sessionUptime(): string {
    const sec = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }

  abort(): void { this.currentAbort?.abort(); }

  clearHistory(): void {
    this.resetHistory();
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.sessionStartTime = Date.now();
  }

  private buildBasePrompt(): string {
    const config = loadConfig();
    let prompt = BILINGUAL_SYSTEM_PROMPT;

    if (this.memoryEnabled) {
      const recentMemories = this.memoryManager.getRecent(25);
      if (recentMemories) {
        prompt += `\n\n=== HAFIZA / MEMORY CONTEXT ===\n${recentMemories}\n=== HAFIZA SONU / END OF MEMORY ===`;
      }
    }

    if (this.selfThinkEnabled) {
      prompt += getSelfThinkInstruction(this.currentLanguage);
    }

    prompt += `\n\n${SELF_AWARENESS_PROMPT}`;
    prompt += getLanguageInstruction(this.currentLanguage);

    if (config.systemPromptAddon) {
      prompt += '\n\n' + config.systemPromptAddon;
    }
    if (config.workspacePath) {
      prompt += `\n\nThe user's workspace root is: ${config.workspacePath}`;
    }
    if (this.safeMode) {
      prompt += `\n\nYou are running in SANDBOX mode. All file operations are restricted to: ${this.sandboxPath}. Execute commands carefully.`;
    }
    if (this.textBasedFallback) {
      prompt += `\n\n=== TEXT TOOL MODE ===
Function calling is unavailable. To use tools, write them on their own line in this format:
TOOL_NAME { "arg1": "val1", "arg2": "val2" }
Example:
execute_bash { "command": "dir" }
browser { "action": "navigate", "url": "https://example.com" }
One tool call per line. The JSON args must be valid. Put each tool call on its own line.`;
    }
    return prompt;
  }

  private resetHistory(systemOverride?: string): void {
    const prompt = systemOverride || this.buildBasePrompt();
    this.messages = [{ role: 'system', content: prompt }];
  }

  private rebuildSystemPrompt(userMessage: string): void {
    const lang = detectLanguage(userMessage);
    this.currentLanguage = lang;

    const config = loadConfig();
    let prompt = BILINGUAL_SYSTEM_PROMPT;

    if (this.memoryEnabled) {
      const recalled = this.memoryManager.recall(userMessage, 15);
      if (recalled.length > 0) {
        prompt += `\n\n=== RELEVANT MEMORIES ===\n${recalled.map(m => `- [${m.type}] ${m.content}`).join('\n')}`;
      }
      const recent = this.memoryManager.getRecent(10);
      if (recent) {
        prompt += `\n\n=== RECENT CONTEXT ===\n${recent}`;
      }
    }

    if (this.selfThinkEnabled && !this.godMode) {
      prompt += getSelfThinkInstruction(lang);
    }

    prompt += `\n\n${SELF_AWARENESS_PROMPT}`;

    if (this.memoryEnabled) {
      const profileSummary = this.profileManager.getProfileSummary();
      if (profileSummary) {
        prompt += `\n\n=== USER PROFILE ===\n${profileSummary}`;
      }
      const welcome = this.profileManager.getWelcomeMessage();
      prompt += `\n\nFirst message hint: ${welcome}`;
    }

    prompt += getLanguageInstruction(lang);

    if (config.systemPromptAddon) {
      prompt += '\n\n' + config.systemPromptAddon;
    }
    if (config.workspacePath) {
      prompt += `\n\nThe user's workspace root is: ${config.workspacePath}`;
    }
    if (this.safeMode) {
      prompt += `\n\nYou are running in SANDBOX mode. All file operations are restricted to: ${this.sandboxPath}. Execute commands carefully.`;
    }

    if (this.textBasedFallback) {
      prompt += `\n\n=== TEXT TOOL MODE ===
Function calling is unavailable. To use tools, write them on their own line in this format:
TOOL_NAME { "arg1": "val1", "arg2": "val2" }
Example:
execute_bash { "command": "dir" }
browser { "action": "navigate", "url": "https://example.com" }
One tool call per line. The JSON args must be valid. Put each tool call on its own line.`;
    }

    if (this.messages.length > 0) {
      this.messages[0].content = prompt;
    } else {
      this.messages.push({ role: 'system', content: prompt });
    }
  }

  private saveSession(): void {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      const file = path.join(SESSIONS_DIR, `session-${this.sessionId}.json`);
      const data = JSON.stringify({
        id: this.sessionId, timestamp: this.sessionStartTime,
        uptime: this.sessionUptime(), promptTokens: this.totalPromptTokens,
        completionTokens: this.totalCompletionTokens, messages: this.messages,
        language: this.currentLanguage,
      }, null, 2);
      fs.writeFileSync(file, data, 'utf-8');
    } catch {}
  }

  private isTemplateArtifact(name: string): boolean {
    return /^(?:assistant|user|system|tool|channel|message|commentary|analysis)$/i.test(name) || name.includes('<|') || name.includes('|>');
  }

  private isValidToolName(name: string): boolean {
    return this.registry.getTool(name) !== undefined;
  }

  private sanitizeToolName(name: string): string {
    const m = name.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    return m ? m[0] : '';
  }

  private malformedToolCount = 0;
  private textBasedFallback = false;

  private parseTextToolCalls(text: string): Array<{ name: string; args: any }> {
    const calls: Array<{ name: string; args: any }> = [];
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const jm = t.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(\{.*\})\s*$/s);
      if (jm && this.isValidToolName(jm[1])) {
        try {
          calls.push({ name: jm[1], args: JSON.parse(jm[2]) });
          Logger.tool(`[text] ${jm[1]}`, 'parsed');
        } catch {}
      }
    }
    return calls;
  }

  private async executeToolCalls(toolCalls: NonNullable<ChatMessage['tool_calls']>): Promise<void> {
    const filtered = toolCalls.filter(tc => !this.isTemplateArtifact(tc.function.name));
    const results = await Promise.all(filtered.map(async (tc) => {
      let args: any;
      try { args = JSON.parse(tc.function.arguments); } catch { args = tc.function.arguments; }
      const rawName = tc.function.name || '';
      const name = this.sanitizeToolName(rawName);
      if (!name || !this.isValidToolName(name)) {
        this.malformedToolCount++;
        Logger.warning(`Tool "${rawName}" not found`);
        if (this.malformedToolCount >= 3) {
          this.textBasedFallback = true;
          Logger.warning('Switching to text-based tool mode');
        }
        return null;
      }
      if (name !== rawName) {
        Logger.tool(`${rawName} -> ${name}`, 'fixed name');
        this.malformedToolCount++;
        if (this.malformedToolCount >= 3) {
          this.textBasedFallback = true;
          Logger.warning('Switching to text-based tool mode');
        }
      }
      Logger.tool(name, 'executing...');
      let result: string;
      try {
        result = await this.registry.executeTool(name, args);
      } catch (e: any) {
        Logger.warning(`Tool ${name} failed: ${e.message}, retrying with cleaned args`);
        const cleanArgs = typeof args === 'object' && args !== null
          ? Object.fromEntries(Object.entries(args).filter(([, v]) => v !== '' && v !== undefined))
          : args;
        try {
          result = await this.registry.executeTool(name, Object.keys(cleanArgs).length ? cleanArgs : args);
        } catch (e2: any) {
          result = `Error: ${e2.message}`;
        }
      }
      return { id: tc.id, name, result };
    }));
    for (const r of results) {
      if (r) this.messages.push({ role: 'tool', tool_call_id: r.id, name: r.name, content: r.result });
    }
  }

  private async executeTextToolCalls(content: string): Promise<boolean> {
    const calls = this.parseTextToolCalls(content);
    if (calls.length === 0) return false;
    Logger.system(`Text tool calls: ${calls.map(c => c.name).join(', ')}`);
    for (const c of calls) {
      const result = await this.registry.executeTool(c.name, c.args);
      this.messages.push({ role: 'tool', tool_call_id: `text-${Date.now()}`, name: c.name, content: result });
    }
    return true;
  }

  private prepareGodmodeRequest(userMessage: string): string {
    const hasPrefill = this.messages.some(m => typeof m.content === 'string' && m.content.includes('[GODMODE PREFILL]'));
    if (!hasPrefill) {
      const strategy = buildStrategy(userMessage, this.model || '', 'basic');
      let system = strategy.systemPrompt;
      if (strategy.decodeInstruction) {
        system += `\n\n${strategy.decodeInstruction}`;
      }

      const lang = detectLanguage(userMessage);
      this.currentLanguage = lang;
      system += getLanguageInstruction(lang);

      this.messages[0] = { role: 'system', content: system };
      this.messages.splice(1, 0, ...strategy.prefillMessages);
      return strategy.obfuscatedMessage;
    }
    return userMessage;
  }

  async run(userMessage: string): Promise<void> {
    const config = loadConfig();
    const maxIterations = this.yoloMode || this.currentTaskYolo ? 100 : (config.maxIterations || 25);

    let finalMessage = this.godMode
      ? this.prepareGodmodeRequest(userMessage)
      : (this.rebuildSystemPrompt(userMessage), userMessage);

    this.messages.push({ role: 'user', content: finalMessage });

    if (this.yoloMode || this.currentTaskYolo) {
      this.messages[0].content += YOLO_PROMPT_ADDON;
    }

    let isDone = false;
    let iteration = 0;

    while (!isDone && iteration < maxIterations) {
      iteration++;
      Logger.system(`Thinking (${iteration}/${maxIterations})...`);
      this.currentAbort = new AbortController();

      try {
        const runTools = this.textBasedFallback ? [] : this.registry.getAllTools();
        const response = await this.provider.generateResponse(
          this.messages, runTools, this.model,
          { signal: this.currentAbort.signal }
        );
        const message = response.message;
        this.messages.push(message);
        if (response.usage) {
          this.totalPromptTokens += response.usage.promptTokens;
          this.totalCompletionTokens += response.usage.completionTokens;
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
          Logger.system(`Tool calls: ${message.tool_calls.map(t => t.function.name).join(', ')}`);
          await this.executeToolCalls(message.tool_calls);
        } else if (this.textBasedFallback && message.content) {
          const hadTextCalls = await this.executeTextToolCalls(message.content);
          if (!hadTextCalls) {
            isDone = true;
            if (message.content?.trim()) {
              Logger.agent(message.content);
              if (this.memoryEnabled) {
                this.memoryManager.remember('episodic', message.content.slice(0, 500), ['auto', 'assistant-response'], 0.3);
              }
            }
          } else {
            this.messages.push({ role: 'assistant', content: message.content });
          }
          if (this.totalCompletionTokens > 0) Logger.usage(this.totalPromptTokens, this.totalCompletionTokens);
        } else {
          isDone = true;
          if (message.content?.trim()) {
            Logger.agent(message.content);
            if (this.memoryEnabled) {
              this.memoryManager.remember('episodic', message.content.slice(0, 500), ['auto', 'assistant-response'], 0.3);
            }
          }
          if (this.totalCompletionTokens > 0) Logger.usage(this.totalPromptTokens, this.totalCompletionTokens);
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message?.includes('canceled')) {
          Logger.warning('Interrupted by user.'); isDone = true; return;
        }
        if (error.message?.includes('Rate limit')) { isDone = true; }
        else { Logger.error('Agent error', error); isDone = true; }
        if (this.messages[this.messages.length - 1]?.role === 'user') this.messages.pop();
      }
    }
    if (iteration >= maxIterations) Logger.warning(`Hit max iterations (${maxIterations}).`);
    this.currentTaskYolo = false;
    this.memoryManager.consolidate();
    this.saveSession();
  }

  async runStream(userMessage: string): Promise<void> {
    const config = loadConfig();
    const maxIterations = this.yoloMode || this.currentTaskYolo ? 100 : (config.maxIterations || 25);

    let finalMessage = this.godMode
      ? this.prepareGodmodeRequest(userMessage)
      : (this.rebuildSystemPrompt(userMessage), userMessage);

    this.messages.push({ role: 'user', content: finalMessage });

    if (this.yoloMode || this.currentTaskYolo) {
      this.messages[0].content += YOLO_PROMPT_ADDON;
    }

    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      if (!this.provider.generateResponseStream) { await this.run(finalMessage); return; }

      Logger.system(`Step ${iteration}/${maxIterations}`);

      this.currentAbort = new AbortController();
      const streamTools = this.textBasedFallback ? [] : this.registry.getAllTools();
      const stream = this.provider.generateResponseStream(
        this.messages, streamTools, this.model,
        { signal: this.currentAbort.signal }
      );
      let content = '';
      let finalMsg: ChatMessage | null = null;

      try {
        for await (const event of stream) {
          if (event.type === 'delta' && event.delta) { content += event.delta; Logger.rawStream(event.delta); }
          else if (event.type === 'usage' && event.usage) {
            this.totalPromptTokens += event.usage.promptTokens;
            this.totalCompletionTokens += event.usage.completionTokens;
          } else if (event.type === 'done') {
            if (event.message?.tool_calls?.length) finalMsg = event.message;
          } else if (event.type === 'error') { Logger.error('Stream error', event.error); this.saveSession(); return; }
        }

        const hasBlockElements = content.split('\n').some(line => {
          const t = line.trim();
          return t.startsWith('```') || (t.startsWith('|') && t.endsWith('|')) || /^#{1,6}\s/.test(t) || /^(\*{3,}|-{3,}|_{3,})\s*$/.test(t) || t.startsWith('> ');
        });

        if (content) {
          if (hasBlockElements) {
            process.stdout.write('\r\x1b[J');
          } else {
            process.stdout.write('\n');
          }
        }

        if (finalMsg?.tool_calls?.length) {
          const toolNames = finalMsg.tool_calls.map(t => t.function.name).join(', ');
          Logger.system(`Tools: ${toolNames}`);
          this.messages.push(finalMsg);
          await this.executeToolCalls(finalMsg.tool_calls);
        } else if (this.textBasedFallback && content) {
          const hadTextCalls = await this.executeTextToolCalls(content);
          this.messages.push({ role: 'assistant', content });
          if (content.trim() && (hasBlockElements || !hadTextCalls)) {
            if (hasBlockElements) Logger.agent(content);
          }
          if (!hadTextCalls) {
            if (this.memoryEnabled && content.trim()) {
              this.memoryManager.remember('episodic', content.slice(0, 500), ['auto', 'assistant-response'], 0.3);
            }
            if (this.totalCompletionTokens > 0) Logger.usage(this.totalPromptTokens, this.totalCompletionTokens);
            this.currentTaskYolo = false;
            this.memoryManager.consolidate();
            this.saveSession();
            return;
          }
        } else {
          const message: ChatMessage = { role: 'assistant', content };
          this.messages.push(message);
          if (content.trim()) {
            if (hasBlockElements) {
              Logger.agent(content);
            }
            if (this.memoryEnabled) {
              this.memoryManager.remember('episodic', content.slice(0, 500), ['auto', 'assistant-response'], 0.3);
            }
          }
          if (this.totalCompletionTokens > 0) Logger.usage(this.totalPromptTokens, this.totalCompletionTokens);
          this.currentTaskYolo = false;
          this.memoryManager.consolidate();
          this.saveSession();
          return;
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message?.includes('canceled')) {
          if (content.trim()) {
            this.messages.push({ role: 'assistant', content });
            Logger.agent(content + '\n\n*[Interrupted by user / Kullanici tarafindan durduruldu]*');
          } else {
            Logger.warning('Interrupted by user.');
          }
          this.saveSession(); return;
        }
        Logger.error('Agent error', error); this.saveSession(); return;
      }
    }
    if (iteration >= maxIterations) Logger.warning(`Hit max iterations (${maxIterations}).`);
    this.currentTaskYolo = false;
    this.memoryManager.consolidate();
    this.saveSession();
  }

  async runForResult(userMessage: string): Promise<string> {
    const config = loadConfig();
    const maxIterations = this.yoloMode ? 100 : (config.maxIterations || 25);

    let finalMessage = this.godMode
      ? this.prepareGodmodeRequest(userMessage)
      : (this.rebuildSystemPrompt(userMessage), userMessage);

    this.messages.push({ role: 'user', content: finalMessage });

    if (this.yoloMode || this.currentTaskYolo) {
      this.messages[0].content += YOLO_PROMPT_ADDON;
    }

    let isDone = false;
    let iteration = 0;

    while (!isDone && iteration < maxIterations) {
      iteration++;
      this.currentAbort = new AbortController();

      try {
        const response = await this.provider.generateResponse(
          this.messages, this.registry.getAllTools(), this.model,
          { signal: this.currentAbort.signal }
        );
        const message = response.message;
        this.messages.push(message);
        if (message.tool_calls && message.tool_calls.length > 0) {
          await this.executeToolCalls(message.tool_calls);
        } else if (this.textBasedFallback && message.content) {
          const hadTextCalls = await this.executeTextToolCalls(message.content);
          if (!hadTextCalls) {
            isDone = true;
            if (message.content?.trim()) {
              if (this.memoryEnabled) {
                this.memoryManager.remember('episodic', message.content.slice(0, 500), ['auto', 'assistant-response'], 0.3);
              }
              this.memoryManager.consolidate();
              return message.content;
            }
            return '';
          }
        } else {
          isDone = true;
          if (message.content?.trim()) {
            if (this.memoryEnabled) {
              this.memoryManager.remember('episodic', message.content.slice(0, 500), ['auto', 'assistant-response'], 0.3);
            }
            this.memoryManager.consolidate();
            return message.content;
          }
          return '';
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message?.includes('canceled')) { return '[Interrupted]'; }
        if (this.messages[this.messages.length - 1]?.role === 'user') this.messages.pop();
        return `[Error: ${error.message}]`;
      }
    }
    return `[Max iterations (${maxIterations}) reached]`;
  }
}
