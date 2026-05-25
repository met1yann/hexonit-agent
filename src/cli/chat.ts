import { input, select } from '@inquirer/prompts';
import { HexonitAgent } from '../core/agent.js';
import { Logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const SESSIONS_DIR = path.join(os.homedir(), '.hexonit', 'sessions');
const HISTORY_FILE = path.join(os.homedir(), '.hexonit', 'history.json');

function detectShellCommand(msg: string): { isShell: boolean; command: string } | null {
  const trimmed = msg.trim();
  if (trimmed.startsWith('!') && trimmed.length > 1) {
    return { isShell: true, command: trimmed.slice(1).trim() };
  }
  return null;
}

function findFile(ref: string, cwd: string): string | null {
  const searchDir = (dir: string, depth: number): string | null => {
    if (depth > 4) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isFile() && e.name.toLowerCase().includes(ref.toLowerCase())) return full;
        if (e.isDirectory() && !e.name.startsWith('.') && !['node_modules', '.git'].includes(e.name)) {
          const found = searchDir(full, depth + 1);
          if (found) return found;
        }
      }
    } catch {}
    return null;
  };
  return searchDir(cwd, 0);
}

async function resolveFileRefs(msg: string, cwd: string): Promise<string> {
  const AT_RE = /@([\w.\-/\\]+)/g;
  let result = msg;
  let match: RegExpExecArray | null;

  while ((match = AT_RE.exec(msg)) !== null) {
    const ref = match[1].trim();
    if (!ref) continue;

    try {
      const found = findFile(ref, cwd);
      if (found) {
        const relPath = path.relative(cwd, found);
        const content = fs.readFileSync(found, 'utf-8').slice(0, 5000);
        const ext = path.extname(found);
        result = result.replace(`@${ref}`, `\n\`${relPath}\`:\n\`\`\`${ext.slice(1)}\n${content}\n\`\`\`\n`);
      }
    } catch {}
  }
  return result;
}

async function runShellCommand(command: string): Promise<string> {
  try {
    const output = execSync(command, { encoding: 'utf-8', timeout: 30000, maxBuffer: 1024 * 1024 });
    return `$ ${command}\n${output}`;
  } catch (e: any) {
    return `$ ${command}\n${chalk.red(`Error: ${e.message}`)}`;
  }
}

function loadHistory(): string[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveHistory(msg: string): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const hist = loadHistory();
    hist.push(msg);
    if (hist.length > 100) hist.splice(0, hist.length - 100);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(hist), 'utf-8');
  } catch {}
}

function copyToClipboard(text: string): void {
  try {
    if (process.platform === 'win32') {
      execSync(`echo ${text.replace(/"/g, '\\"')} | clip`, { timeout: 2000 });
    } else {
      execSync(`echo "${text.replace(/"/g, '\\"')}" | pbcopy`, { timeout: 2000 });
    }
    Logger.success('Copied to clipboard / Panoya kopyalandı');
  } catch {
    Logger.warning('Clipboard not available / Pano kullanılamıyor');
  }
}

function showForkOptions(agent: HexonitAgent): void {
  Logger.divider('FORK SESSION');
  Logger.info('Starting a new session with context from current conversation.');
  agent.clearHistory();
  Logger.success('Session forked / Oturum çatallandı.');
}

function showSessionList(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    Logger.info('No saved sessions / Kayıtlı oturum yok.');
    return;
  }

  const files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 15);

  if (files.length === 0) { Logger.info('No saved sessions / Kayıtlı oturum yok.'); return; }

  Logger.divider('SAVED SESSIONS');
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8'));
      const id = data.id || f.replace('.json', '');
      const count = data.messages?.length || 0;
      const date = data.timestamp ? new Date(data.timestamp).toLocaleString() : '?';
      Logger.info(`${chalk.cyan(id.slice(0, 24).padEnd(26))} ${chalk.dim(date.padEnd(20))} ${String(count).padStart(3)} msgs`);
    } catch {}
  }
}

function showExportOptions(agent: HexonitAgent): void {
  const dir = SESSIONS_DIR;
  if (!fs.existsSync(dir)) { Logger.info('No sessions to export.'); return; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 5);
  if (files.length === 0) { Logger.info('No sessions to export.'); return; }

  Logger.divider('EXPORT SESSION');
  for (const f of files) {
    const sid = f.replace('session-', '').replace('.json', '');
    Logger.info(`  ${chalk.cyan(sid)}`);
  }
  Logger.info(`\n  Use: hexonit export <session-id>`);
}

function showEditorPrompt(): void {
  const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vim');
  Logger.info(`Opening ${chalk.cyan(editor)}...`);
}

function showMemoryStatus(agent: HexonitAgent): void {
  const stats = agent.getMemoryStats();
  Logger.divider('HAFIZA / MEMORY');
  Logger.info(`Short-term: ${chalk.cyan(String(stats.shortTerm))} entries`);
  Logger.info(`Long-term: ${chalk.cyan(String(stats.longTerm))} entries`);
  Logger.info(`Total: ${chalk.cyan(String(stats.total))} entries`);
  Logger.info(`Memory enabled: ${agent.isMemoryEnabled() ? chalk.green('YES') : chalk.dim('NO')}`);
}

async function showMemoryRecall(agent: HexonitAgent): Promise<void> {
  try {
    const query = await input({
      message: chalk.cyan('Search memory / Hafızada ara:'),
    });
    if (!query.trim()) return;
    const results = agent.recallMemory(query.trim());
    if (results.length === 0) {
      Logger.info('No matching memories / Eşleşen hafıza bulunamadı.');
      return;
    }
    Logger.divider(`MEMORY RESULTS (${results.length})`);
    for (const m of results) {
      const date = new Date(m.timestamp).toLocaleString();
      Logger.info(`${chalk.cyan(`[${m.type}]`)} ${chalk.dim(date)} ${chalk.yellow(`(${(m.importance * 100).toFixed(0)}%)`)}`);
      Logger.info(`  ${m.content.slice(0, 200)}`);
    }
  } catch {}
}

function showLanguageOptions(agent: HexonitAgent): void {
  const current = agent.getCurrentLanguage();
  Logger.divider('DIL / LANGUAGE');
  Logger.info(`Current: ${chalk.cyan(current === 'tr' ? 'Türkçe' : 'English')}`);
  Logger.info('Use /lang tr or /lang en to switch');
}

function showBetaWarning(): void {
  console.log(chalk.yellow('  ╔════════════════════════════════════════╗'));
  console.log(chalk.yellow('  ║  ⚠  BETA — Hata yapabilir             ║'));
  console.log(chalk.yellow('  ║  May make mistakes                     ║'));
  console.log(chalk.yellow('  ║  Geri bildirim: github.com/anomalyco/  ║'));
  console.log(chalk.yellow('  ╚════════════════════════════════════════╝'));
  console.log('');
}

export async function runChat(agent: HexonitAgent, options?: any): Promise<void> {
  Logger.splashScreen();
  showBetaWarning();

  const isForked = options?.fork;
  const isContinued = options?.continue;

  if (isForked) {
    Logger.info(chalk.dim('Session forked from previous conversation.'));
  } else if (isContinued) {
    Logger.info(chalk.dim('Continuing previous session.'));
  }

  if (isContinued && !isForked) {
    const files = fs.existsSync(SESSIONS_DIR)
      ? fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')).sort().reverse()
      : [];
    if (files.length > 0) {
      try {
        const last = files[0];
        const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, last), 'utf-8'));
        if (data.messages?.length > 1) {
          const msgCount = data.messages.length;
          Logger.info(`Loaded session with ${msgCount} messages.`);

          if (isForked) {
            agent.clearHistory();
            Logger.info('Session forked.');
          } else {
            agent.clearHistory();
            for (const msg of data.messages) {
              if (msg.role === 'system') continue;
              (agent as any).messages?.push(msg);
            }
          }
        }
      } catch {}
    }
  }

  Logger.info(chalk.dim('Type your message or use:'));
  Logger.info(chalk.dim('  @file    — Reference a file  |  !command — Run shell command'));
  Logger.info(chalk.dim('  /help    — Show commands     |  /       — Open command menu'));
  console.log('');

  let exit = false;
  const commandHistory: string[] = loadHistory();
  let historyIndex = -1;
  let lastMessages: { user: string; assistant: string }[] = [];

  while (!exit) {
    let rawInput: string;
    try {
      rawInput = await input({
        message: chalk.cyan('You'),
        theme: {
          prefix: chalk.cyan('\u276F'),
          style: { message: (t: string) => chalk.cyan(t) },
        },
      });
    } catch {
      exit = true;
      break;
    }

    const sanitized = rawInput.trim();
    if (!sanitized) continue;

    if (sanitized === 'undo' || sanitized === '/undo') {
      if (lastMessages.length > 0) {
        const last = lastMessages.pop()!;
        Logger.info(`Undid: "${last.user.slice(0, 60)}"`);
        continue;
      }
      Logger.warning('Nothing to undo / Geri alınacak bir şey yok.');
      continue;
    }

    if (sanitized === '/redo' || sanitized === 'redo') {
      Logger.warning('No redo history available.');
      continue;
    }

    if (sanitized === '/copy' || sanitized === 'copy') {
      if (lastMessages.length > 0) {
        const last = lastMessages[lastMessages.length - 1];
        copyToClipboard(last.assistant);
      } else {
        Logger.warning('No messages to copy.');
      }
      continue;
    }

    if (sanitized === '/fork') {
      showForkOptions(agent);
      continue;
    }

    if (sanitized === '/sessions' || sanitized === '/resume') {
      showSessionList();
      continue;
    }

    if (sanitized === '/export') {
      showExportOptions(agent);
      continue;
    }

    if (sanitized === '/compact' || sanitized === '/summarize') {
      Logger.warning('Session compaction not available / Oturum sıkıştırma mevcut değil.');
      continue;
    }

    if (sanitized === '/editor') {
      showEditorPrompt();
      continue;
    }

    if (sanitized === '/new' || sanitized === '/clear') {
      console.clear();
      agent.clearHistory();
      lastMessages = [];
      Logger.splashScreen();
      showBetaWarning();
      Logger.success('Fresh session started / Yeni oturum başlatıldı.');
      continue;
    }

    if (sanitized === '/' || sanitized === '/menu') {
      const SLASH_MENU_ITEMS = [
        { name: chalk.white('\u2753  Help & commands        /help'), value: '/help' },
        { name: chalk.white('\uD83D\uDD04  New session             /new'), value: '/new' },
        { name: chalk.white('\u2139\uFE0F  Agent status            /status'), value: '/status' },
        { name: chalk.white('\uD83E\uDDE0  Memory management       /memory'), value: '/memory' },
        { name: chalk.white('\uD83D\uDDD1\uFE0F  Forget memories         /forget'), value: '/forget' },
        { name: chalk.white('\uD83C\uDF10  Change language          /lang'), value: '/lang' },
        { name: chalk.white('\uD83E\uDD16  Self-think mode          /think'), value: '/think' },
        { name: chalk.white('\uD83D\uDEE0\uFE0F  Registered tools        /tools'), value: '/tools' },
        { name: chalk.white('\uD83D\uDCBB  System telemetry         /system'), value: '/system' },
        { name: chalk.white('\uD83D\uDCC8  Token usage              /tokens'), value: '/tokens' },
        { name: chalk.white('\uD83D\uDC7F  Toggle GODMODE           /godmode'), value: '/godmode' },
        { name: chalk.white('\uD83C\uDFAF  Toggle YOLO mode         /yolomode'), value: '/yolomode' },
        { name: chalk.white('\uD83D\uDD04  Loop current task        /loop'), value: '/loop' },
        { name: chalk.white('\uD83D\uDCE6  Toggle sandbox           /sandbox'), value: '/sandbox' },
        { name: chalk.white('\u2705  Always approve           /autoapprove'), value: '/autoapprove' },
        { name: chalk.white('\uD83E\uDD16  Change model             /model'), value: '/model' },
        { name: chalk.white('\uD83D\uDCCB  List sessions            /sessions'), value: '/sessions' },
        { name: chalk.white('\uD83D\uDCC4  Export session           /export'), value: '/export' },
        { name: chalk.white('\uD83D\uDDC2\uFE0F  Fork session             /fork'), value: '/fork' },
        { name: chalk.white('\u2702\uFE0F  Copy last response       /copy'), value: '/copy' },
        { name: chalk.white('\uD83D\uDD19  Undo last message        /undo'), value: '/undo' },
        { name: chalk.white('\uD83D\uDEAA  Exit                    /exit'), value: '/exit' },
        { name: chalk.dim('\u25C0  Cancel'), value: 'cancel' },
      ];

      const command = await select<string>({
        message: chalk.cyan('Command menu / Komut menüsü:'),
        choices: SLASH_MENU_ITEMS,
        pageSize: 22,
      });

      if (command === 'cancel') continue;
      if (command === '/exit') { exit = true; break; }
      if (command === '/sessions') { showSessionList(); continue; }
      if (command === '/export') { showExportOptions(agent); continue; }
      if (command === '/fork') { showForkOptions(agent); continue; }
      if (command === '/copy') {
        if (lastMessages.length > 0) {
          copyToClipboard(lastMessages[lastMessages.length - 1].assistant);
        } else { Logger.warning('No messages to copy.'); }
        continue;
      }
      if (command === '/undo') {
        if (lastMessages.length > 0) { lastMessages.pop(); Logger.info('Undone / Geri alındı.'); }
        else { Logger.warning('Nothing to undo.'); }
        continue;
      }
      if (command === '/memory') {
        showMemoryStatus(agent);
        await showMemoryRecall(agent);
        continue;
      }
      if (command === '/forget') { await handleForget(agent); continue; }
      if (command === '/lang') { await handleLanguageSwitch(agent); continue; }
      if (command === '/think') { handleThinkToggle(agent); continue; }

      await handleDirectCommand(command, agent);
      continue;
    }

    if (sanitized.startsWith('/')) {
      const handled = await handleDirectCommand(sanitized.toLowerCase(), agent);
      if (handled) continue;
    }

    if (['exit', 'quit'].includes(sanitized.toLowerCase())) { exit = true; continue; }

    const shellCmd = detectShellCommand(sanitized);
    if (shellCmd) {
      Logger.tool('bash', `Running: ${shellCmd.command}`);
      Logger.divider('SHELL OUTPUT');
      const output = await runShellCommand(shellCmd.command);
      console.log(chalk.dim(output));
      continue;
    }

    let processedMsg = sanitized;
    if (processedMsg.includes('@')) {
      processedMsg = await resolveFileRefs(processedMsg, process.cwd());
    }

    saveHistory(sanitized);
    historyIndex = -1;

    Logger.divider();

    try {
      if (agent.supportsStreaming()) {
        await agent.runStream(processedMsg);
      } else {
        await agent.run(processedMsg);
      }

      Logger.divider();
      Logger.info(chalk.dim('Continue / Devam et veya bir komut yaz.'));
      console.log('');
    } catch (error: any) {
      Logger.error('Chat error', error);
    }
  }

  Logger.divider();
  Logger.system('Session ended / Oturum sonlandı.');
}

async function handleForget(agent: HexonitAgent): Promise<void> {
  try {
    const answer = await input({
      message: chalk.yellow('Clear ALL memory? / Tüm hafızayı sil? (yes/no):'),
    });
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      agent.wipeMemory();
      Logger.success('Memory cleared / Hafıza temizlendi.');
    } else {
      Logger.info('Cancelled / İptal edildi.');
    }
  } catch {}
}

async function handleLanguageSwitch(agent: HexonitAgent): Promise<void> {
  try {
    const lang = await select<string>({
      message: chalk.cyan('Select language / Dil seç:'),
      choices: [
        { name: 'Türkçe', value: 'tr' },
        { name: 'English', value: 'en' },
      ],
    });
    agent.setLanguage(lang as 'tr' | 'en');
    Logger.success(`Language changed to: ${chalk.cyan(lang === 'tr' ? 'Türkçe' : 'English')}`);
  } catch {}
}

function handleThinkToggle(agent: HexonitAgent): void {
  const now = agent.toggleSelfThink();
  Logger.divider(now ? 'SELF-THINK / BILINÇ MODU ACTIVE' : 'SELF-THINK / BILINÇ MODU OFF');
  Logger.warning(now ? 'Agent will reason internally before responding.' : 'Self-think disabled.');
}

async function handleDirectCommand(cmd: string, agent: HexonitAgent): Promise<boolean> {
  switch (cmd) {
    case '/help': {
      Logger.commandList();
      return true;
    }
    case '/new':
    case '/clear': {
      console.clear();
      agent.clearHistory();
      Logger.splashScreen();
      showBetaWarning();
      Logger.success('Fresh session started / Yeni oturum başlatıldı.');
      return true;
    }
    case '/status': {
      Logger.divider('SESSION STATUS');
      Logger.info(`Agent: ${chalk.cyan('Hexonit v2.1.0-beta')}`);
      Logger.info(`Provider: ${chalk.cyan(agent.getProviderName())}`);
      Logger.info(`Model: ${chalk.cyan(agent.getModel())}`);
      Logger.info(`Uptime: ${chalk.cyan(agent.sessionUptime())}`);
      Logger.info(`Messages: ${chalk.cyan(String(agent.getMessageCount()))}`);
      Logger.info(`Tokens: ${chalk.cyan(`${agent.totalPromptTokens}\u2191 ${agent.totalCompletionTokens}\u2193`)}`);
      Logger.info(`Language: ${chalk.cyan(agent.getCurrentLanguage() === 'tr' ? 'Türkçe' : 'English')}`);
      Logger.info(`Self-think: ${agent.isSelfThink() ? chalk.green('ON') : chalk.dim('OFF')}`);
      Logger.info(`Memory: ${agent.isMemoryEnabled() ? chalk.green('ON') : chalk.dim('OFF')}`);
      const memStats = agent.getMemoryStats();
      Logger.info(`Memory count: ${chalk.cyan(String(memStats.total))}`);
      Logger.info(`Godmode: ${agent.isGodMode() ? chalk.green('ON') : chalk.dim('OFF')}`);
      Logger.info(`YOLO mode: ${agent.isYoloMode() ? chalk.green('ON') : chalk.dim('OFF')}`);
      Logger.info(`Auto-approve: ${agent.isAutoApprove() ? chalk.green('ON') : chalk.dim('OFF')}`);
      Logger.info(`Sandbox: ${agent.isSafeMode() ? chalk.green('ON') : chalk.dim('OFF')}`);
      return true;
    }
    case '/memory': {
      showMemoryStatus(agent);
      await showMemoryRecall(agent);
      return true;
    }
    case '/forget': {
      await handleForget(agent);
      return true;
    }
    case '/lang': {
      showLanguageOptions(agent);
      await handleLanguageSwitch(agent);
      return true;
    }
    case '/think': {
      handleThinkToggle(agent);
      return true;
    }
    case '/tools': {
      Logger.divider('REGISTERED TOOLS');
      for (const t of agent.getTools()) {
        Logger.info(`${chalk.cyan(t.name.padEnd(18))} ${chalk.dim(t.description.split('\n')[0])}`);
      }
      return true;
    }
    case '/system': {
      Logger.divider('SYSTEM TELEMETRY');
      Logger.system(`Platform: ${os.type()} ${os.release()} (${os.arch()})`);
      Logger.system(`Memory: ${(os.totalmem() / 1e9).toFixed(2)} GB total / ${(os.freemem() / 1e9).toFixed(2)} GB free`);
      Logger.system(`CPU: ${os.cpus()[0]?.model || 'N/A'} (${os.cpus().length} cores)`);
      Logger.system(`Uptime: ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`);
      return true;
    }
    case '/tokens': {
      Logger.divider('TOKEN USAGE');
      Logger.info(`Prompt tokens: ${chalk.cyan(String(agent.totalPromptTokens))}`);
      Logger.info(`Completion tokens: ${chalk.cyan(String(agent.totalCompletionTokens))}`);
      Logger.info(`Total: ${chalk.cyan(String(agent.totalPromptTokens + agent.totalCompletionTokens))}`);
      return true;
    }
    case '/godmode': {
      const was = agent.isGodMode();
      if (was) { Logger.info('Already in GODMODE.'); return true; }
      agent.toggleGodMode();
      Logger.divider('GODMODE ACTIVE');
      Logger.warning('Unrestricted mode enabled.');
      return true;
    }
    case '/ungod': {
      if (!agent.isGodMode()) { Logger.info('Already in normal mode.'); return true; }
      agent.toggleGodMode();
      Logger.divider('GODMODE DEACTIVATED');
      Logger.success('Returned to standard operation.');
      return true;
    }
    case '/yolomode':
    case '/unyo': {
      const yolo = agent.toggleYoloMode();
      Logger.divider(yolo ? 'YOLO MODE ACTIVE' : 'YOLO MODE OFF');
      Logger.warning(yolo ? 'Tasks will auto-loop until fully completed.' : 'Returned to normal execution.');
      return true;
    }
    case '/loop': {
      Logger.divider('TASK LOOP');
      Logger.info('Send your task - it will loop until fully complete.');
      return true;
    }
    case '/sandbox': {
      const sb = agent.toggleSafeMode();
      Logger.divider(sb ? 'SANDBOX ACTIVE' : 'SANDBOX OFF');
      Logger.info(sb ? 'Operations restricted to sandbox directory.' : 'Full system access restored.');
      return true;
    }
    case '/autoapprove':
    case '/approve': {
      const now = agent.isAutoApprove();
      agent.setAutoApprove(!now);
      Logger.divider(!now ? 'AUTO-APPROVE ON' : 'AUTO-APPROVE OFF');
      Logger.warning(!now ? 'All tool operations auto-approved.' : 'Each tool operation will ask for permission.');
      return true;
    }
    case '/model': {
      const current = agent.getModel();
      try {
        const newModel = await input({
          message: chalk.cyan(`Current: ${current}. Enter new model:`),
          default: current,
        });
        if (newModel.trim()) {
          agent.setModel(newModel.trim());
          Logger.success(`Model changed to: ${chalk.cyan(newModel.trim())}`);
        }
      } catch {}
      return true;
    }
    case '/sessions':
    case '/resume': {
      showSessionList();
      return true;
    }
    case '/fork': {
      showForkOptions(agent);
      return true;
    }
    case '/export': {
      showExportOptions(agent);
      return true;
    }
    case '/undo': {
      Logger.info('Use "undo" without / to undo last message.');
      return true;
    }
    case '/copy': {
      Logger.info('Use "copy" without / to copy last response.');
      return true;
    }
    case '/compact':
    case '/summarize': {
      Logger.warning('Session compaction not available / Oturum sıkıştırma mevcut değil.');
      return true;
    }
    case '/editor': {
      showEditorPrompt();
      return true;
    }
    case '/exit':
    case '/quit': {
      Logger.system('Shutting down / Kapatılıyor...');
      process.exit(0);
    }
    default:
      return false;
  }
}
