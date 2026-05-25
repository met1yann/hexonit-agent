#!/usr/bin/env node

import { Command } from 'commander';
import { runSetup } from './setup.js';
import { runChat } from './chat.js';
import { runGatewayCommand } from './gateway.js';
import { loadConfig, clearConfig } from '../utils/config.js';
import { confirm } from '@inquirer/prompts';
import { OpenRouterProvider } from '../providers/openrouter.js';
import { OpenAIProvider } from '../providers/openai.js';
import { AnthropicProvider } from '../providers/anthropic.js';
import { GroqProvider } from '../providers/groq.js';
import { BaseProvider } from '../providers/index.js';
import { ToolRegistry } from '../tools/index.js';
import { HexonitAgent } from '../core/agent.js';
import { BashTool } from '../tools/builtin/bash.js';
import { ReadFileTool } from '../tools/builtin/read-file.js';
import { WriteFileTool } from '../tools/builtin/write-file.js';
import { WebSearchTool } from '../tools/builtin/web-search.js';
import { TelegramSendTool } from '../tools/builtin/telegram.js';
import { GithubSearchTool } from '../tools/builtin/github.js';
import { SystemInfoTool } from '../tools/builtin/system-info.js';
import { FetchUrlTool } from '../tools/builtin/fetch-url.js';
import { ListDirTool } from '../tools/builtin/list-dir.js';
import { CreateTool } from '../tools/builtin/create-tool.js';
import { BrowserTool } from '../tools/builtin/browser.js';
import { EditMultipleTool } from '../tools/builtin/edit-multiple.js';
import { SearchCodeTool } from '../tools/builtin/search-code.js';
import { GitTool } from '../tools/builtin/git.js';
import { ProjectContextTool } from '../tools/builtin/project-context.js';
import { SubagentTool } from '../tools/builtin/subagent.js';
import { RunCommandTool } from '../tools/builtin/run-command.js';
import { Logger } from '../utils/logger.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PROVIDER_MAP: Record<string, new (key: string, model: string) => BaseProvider> = {
  openrouter: OpenRouterProvider,
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  groq: GroqProvider,
};

const SESSIONS_DIR = path.join(os.homedir(), '.hexonit', 'sessions');

const BETA_WARNING = chalk.yellow('⚠  BETA — Hata yapabilir / May make mistakes');

function createAgent(providerName?: string, modelName?: string): HexonitAgent {
  const config = loadConfig();
  const pn = providerName || config.defaultProvider;
  const mn = modelName || config.defaultModel;
  const apiKey = config.keys[pn];

  if (!apiKey) {
    Logger.error(`No API key for "${pn}". Run "hexonit setup" or set ${pn.toUpperCase()}_API_KEY env.`);
    process.exit(1);
  }

  const ProviderClass = PROVIDER_MAP[pn];
  if (!ProviderClass) {
    Logger.error(`Unsupported provider: "${pn}". Use: ${Object.keys(PROVIDER_MAP).join(', ')}`);
    process.exit(1);
  }

  const provider: BaseProvider = new ProviderClass(apiKey, mn);
  const registry = new ToolRegistry();
  registry.register(new BashTool());
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new WebSearchTool());
  registry.register(new TelegramSendTool());
  registry.register(new GithubSearchTool());
  registry.register(new SystemInfoTool());
  registry.register(new FetchUrlTool());
  registry.register(new ListDirTool());
  registry.register(new CreateTool(registry));
  registry.register(new BrowserTool());
  registry.register(new EditMultipleTool());
  registry.register(new SearchCodeTool());
  registry.register(new GitTool());
  registry.register(new ProjectContextTool());
  registry.register(new RunCommandTool());
  registry.register(new SubagentTool(async (task) => {
    const child = createAgent(pn, mn);
    child.setModel(mn);
    const result = await child.runForResult(task);
    child.cleanup();
    return result;
  }));

  return new HexonitAgent(provider, registry, mn);
}

const program = new Command();

program
  .name('hexonit')
  .description(`Hexonit — Autonomous AI Agent CLI  |  ${BETA_WARNING}`)
  .version('2.1.0-beta');

program
  .command('setup')
  .description('Interactive configuration wizard [BETA]')
  .action(async () => {
    await runSetup();
  });

program
  .command('chat')
  .description('Start an interactive AI agent session [BETA]')
  .option('-p, --provider <name>', 'Override default provider')
  .option('-m, --model <name>', 'Override default model')
  .option('-c, --continue', 'Continue last session')
  .option('--fork', 'Fork the last session')
  .action(async (options) => {
    const agent = createAgent(options.provider, options.model);
    await runChat(agent, options);
  });

program
  .command('run')
  .description('Run a prompt in non-interactive mode [BETA]')
  .argument('[message...]', 'The prompt to execute')
  .option('-p, --provider <name>', 'Override default provider')
  .option('-m, --model <name>', 'Override default model')
  .option('-c, --continue', 'Continue last session')
  .option('--fork', 'Fork the last session')
  .option('--json', 'Output raw JSON events')
  .action(async (args, options) => {
    if (!args || args.length === 0) {
      Logger.error('Usage: hexonit run "your prompt here"');
      process.exit(1);
    }
    const prompt = args.join(' ');
    const agent = createAgent(options.provider, options.model);

    const config = loadConfig();
    if (config.godMode) agent.toggleGodMode();

    Logger.splashScreen();
    Logger.divider('NON-INTERACTIVE RUN');
    Logger.info(`Prompt: ${chalk.white(prompt)}`);
    console.log('');

    if (agent.supportsStreaming()) {
      await agent.runStream(prompt);
    } else {
      await agent.run(prompt);
    }
  });

program
  .command('reset')
  .description('Reset all configuration (API keys, sessions, memory) [BETA]')
  .option('--keep-keys', 'Keep API keys / Anahtarları koru')
  .option('--keep-memory', 'Keep memory / Hafızayı koru')
  .option('--keep-sessions', 'Keep sessions / Oturumları koru')
  .option('--dry-run', 'Show what would be deleted / Ne silineceğini göster')
  .action(async (options) => {
    Logger.splashScreen();
    console.log('\n' + chalk.yellow('  +----------------------------------------------+'));
    console.log(chalk.yellow('  |       !  RESET / SIFIRLA  !                  |'));
    console.log(chalk.yellow('  |   BETA - Hata yapabilir                      |'));
    console.log(chalk.yellow('  +----------------------------------------------+') + '\n');

    const toDelete = clearConfig({
      keepKeys: options.keepKeys,
      keepMemory: options.keepMemory,
      dryRun: true,
    });

    if (!options.keepSessions) {
      toDelete.push('Session directory');
    }

    Logger.warning('The following will be deleted / Şunlar silinecek:');
    for (const item of toDelete) {
      Logger.info(`  ${chalk.red('✗')} ${item}`);
    }

    if (options.dryRun) {
      Logger.info('Dry run — nothing was deleted / Hiçbir şey silinmedi.');
      return;
    }

    try {
      const confirmed = await confirm({
        message: chalk.red('Are you sure? / Emin misin?'),
        default: false,
      });

      if (!confirmed) {
        Logger.info('Cancelled / İptal edildi.');
        return;
      }
    } catch {
      Logger.info('Cancelled / İptal edildi.');
      return;
    }

    clearConfig({ keepKeys: options.keepKeys, keepMemory: options.keepMemory });

    if (!options.keepSessions) {
      try {
        if (fs.existsSync(SESSIONS_DIR)) {
          const files = fs.readdirSync(SESSIONS_DIR);
          for (const f of files) {
            try { fs.unlinkSync(path.join(SESSIONS_DIR, f)); } catch {}
          }
        }
      } catch {}
    }

    console.log('\n' + chalk.green('  +----------------------------------------------+'));
    console.log(chalk.green('  |  OK  Reset complete / Sifirlama tamam    |'));
    console.log(chalk.green('  |  Run ') + chalk.white('hexonit setup') + chalk.green(' to reconfigure      |'));
    console.log(chalk.green('  +----------------------------------------------+') + '\n');
  });

const sessionCmd = program
  .command('session')
  .alias('sessions')
  .description('Manage sessions (list, delete, export) [BETA]');

sessionCmd
  .command('list')
  .description('List all sessions / Tüm oturumları listele [BETA]')
  .option('-n, --max-count <number>', 'Limit to N most recent')
  .action((options) => {
    if (!fs.existsSync(SESSIONS_DIR)) {
      Logger.info('No sessions found / Oturum bulunamadı.');
      return;
    }
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const p = path.join(SESSIONS_DIR, f);
        const stat = fs.statSync(p);
        let data: any = {};
        try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
        return { file: f, time: stat.mtimeMs, id: data.id || f.replace('session-', '').replace('.json', ''), uptime: data.uptime || '?', msgs: data.messages?.length || 0 };
      })
      .sort((a, b) => b.time - a.time);

    const maxCount = parseInt(options.maxCount) || files.length;
    const limited = files.slice(0, maxCount);

    if (limited.length === 0) {
      Logger.info('No sessions found / Oturum bulunamadı.');
      return;
    }

    Logger.divider(`SESSIONS (${limited.length})`);
    for (const s of limited) {
      const date = new Date(s.time).toLocaleString();
      Logger.info(`${chalk.cyan(s.id.slice(0, 20).padEnd(22))} ${chalk.dim(date.padEnd(20))} ${String(s.msgs).padStart(3)} msgs  ${s.uptime}`);
    }
  });

sessionCmd
  .command('delete')
  .description('Delete a session / Oturum sil [BETA]')
  .argument('<id>', 'Session ID to delete')
  .action((id) => {
    const file = path.join(SESSIONS_DIR, `session-${id}.json`);
    if (!fs.existsSync(file)) {
      Logger.error(`Session not found: ${id}`);
      return;
    }
    fs.unlinkSync(file);
    Logger.success(`Deleted session: ${id}`);
  });

sessionCmd
  .command('export')
  .description('Export a session as JSON [BETA]')
  .argument('[id]', 'Session ID (omit to list)')
  .action((id) => {
    if (!id) {
      if (!fs.existsSync(SESSIONS_DIR)) { Logger.info('No sessions.'); return; }
      const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 10);
      if (files.length === 0) { Logger.info('No sessions.'); return; }
      Logger.divider('RECENT SESSIONS');
      for (const f of files) {
        const sid = f.replace('session-', '').replace('.json', '');
        Logger.info(`  ${chalk.cyan(sid)}`);
      }
      Logger.info(`\n  Use: hexonit session export <id>`);
      return;
    }
    const file = path.join(SESSIONS_DIR, `session-${id}.json`);
    if (!fs.existsSync(file)) {
      Logger.error(`Session not found: ${id}`);
      return;
    }
    const data = fs.readFileSync(file, 'utf-8');
    const outFile = `hexonit-session-${id}.json`;
    fs.writeFileSync(outFile, data, 'utf-8');
    Logger.success(`Exported to: ${outFile}`);
  });

program
  .command('models')
  .description('List available models from configured providers [BETA]')
  .option('--refresh', 'Refresh model cache')
  .action(async (options) => {
    const config = loadConfig();
    Logger.divider('CONFIGURED PROVIDERS');
    for (const provider of Object.keys(PROVIDER_MAP)) {
      const hasKey = !!config.keys[provider];
      Logger.info(`${chalk.cyan(provider.padEnd(14))} ${hasKey ? chalk.green('\u2713 configured') : chalk.dim('no API key')}`);
      if (hasKey && provider === config.defaultProvider) {
        Logger.info(`${' '.repeat(14)}  ${chalk.dim('Default model:')} ${chalk.white(config.defaultModel)}`);
      }
    }
    Logger.info(`\n  Set model with: ${chalk.cyan('hexonit chat -m <model>')}`);
  });

program
  .command('continue')
  .description('Continue the most recent session [BETA]')
  .option('-p, --provider <name>', 'Override default provider')
  .option('-m, --model <name>', 'Override default model')
  .option('--fork', 'Fork the session')
  .action(async (options) => {
    const agent = createAgent(options.provider, options.model);
    await runChat(agent, { ...options, continue: true });
  });

program
  .command('fork')
  .description('Fork the most recent session into a new one [BETA]')
  .option('-p, --provider <name>', 'Override default provider')
  .option('-m, --model <name>', 'Override default model')
  .action(async (options) => {
    const agent = createAgent(options.provider, options.model);
    await runChat(agent, { ...options, continue: true, fork: true });
  });

program
  .command('gateway')
  .description('Manage the background daemon [BETA]')
  .argument('<action>', 'start, stop, restart, or status')
  .action(async (action: string) => {
    await runGatewayCommand(action);
  });

program
  .command('export')
  .description('Export a session as JSON [BETA]')
  .argument('[id]', 'Session ID')
  .action((id) => {
    const file = id
      ? path.join(SESSIONS_DIR, `session-${id}.json`)
      : path.join(SESSIONS_DIR, fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')).sort().reverse()[0] || '');
    if (!file || !fs.existsSync(file)) {
      Logger.error('No session found.');
      return;
    }
    const data = fs.readFileSync(file, 'utf-8');
    const outFile = `hexonit-session-${path.basename(file).replace('session-', '').replace('.json', '')}.json`;
    fs.writeFileSync(outFile, data, 'utf-8');
    Logger.success(`Exported to: ${outFile}`);
  });

program.action(() => {
  console.log(chalk.yellow('  +----------------------------------------------+'));
  console.log(chalk.yellow('  |         !  HEXONIT BETA  !                   |'));
  console.log(chalk.yellow('  |  Hata yapabilir / May make mistakes         |'));
  console.log(chalk.yellow('  +----------------------------------------------+'));
  Logger.splashScreen();
  console.log(chalk.dim('\n  Usage / Kullanım:'));
  console.log(chalk.dim('    hexonit                 ') + chalk.white('Start interactive chat'));
  console.log(chalk.dim('    hexonit chat            ') + chalk.white('Start interactive chat'));
  console.log(chalk.dim('    hexonit run "prompt"    ') + chalk.white('Run a prompt non-interactively'));
  console.log(chalk.dim('    hexonit setup           ') + chalk.white('Configuration wizard'));
  console.log(chalk.dim('    hexonit reset           ') + chalk.white('Reset everything'));
  console.log(chalk.dim('    hexonit session list    ') + chalk.white('List sessions'));
  console.log(chalk.dim('    hexonit continue        ') + chalk.white('Continue last session'));
  console.log(chalk.dim('    hexonit fork            ') + chalk.white('Fork last session'));
  console.log(chalk.dim('    hexonit export [id]     ') + chalk.white('Export session'));
  console.log(chalk.dim('    hexonit models          ') + chalk.white('Show configured providers'));
  console.log('');
  console.log(chalk.dim('  ' + BETA_WARNING));
  console.log('');
});

program.parse(process.argv);
