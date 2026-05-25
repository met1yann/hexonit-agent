import { input, select, confirm, password } from '@inquirer/prompts';
import { loadConfig, saveConfig, HexonitConfig } from '../utils/config.js';
import { Logger, invalidateThemeCache } from '../utils/logger.js';
import chalk from 'chalk';

const PROVIDER_MODELS: Record<string, string[]> = {
  openrouter: ['anthropic/claude-3-haiku', 'anthropic/claude-sonnet-4-20250514', 'google/gemini-2.0-flash-001', 'openai/gpt-4o', 'deepseek/deepseek-chat', 'meta-llama/llama-3.2-90b-vision-instruct'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
};

const PROVIDER_DETAILS: Record<string, { url: string; color: string }> = {
  openrouter: { url: 'https://openrouter.ai/keys', color: '#3182CE' },
  openai: { url: 'https://platform.openai.com/api-keys', color: '#10A37F' },
  anthropic: { url: 'https://console.anthropic.com/settings/keys', color: '#D97706' },
  groq: { url: 'https://console.groq.com/keys', color: '#F97316' },
};

function renderTitle(text: string): void {
  const w = Math.min(process.stdout.columns || 80, 60);
  const pad = Math.max(0, Math.floor((w - text.length - 4) / 2));
  console.log('\n' + chalk.yellow('+' + '-'.repeat(w) + '+'));
  console.log(chalk.yellow('|') + ' '.repeat(pad) + chalk.bold('! ' + text + ' !') + ' '.repeat(Math.max(0, w - pad - text.length - 4)) + chalk.yellow('|'));
  console.log(chalk.yellow('|') + ' '.repeat(Math.max(0, Math.floor((w - 38) / 2))) + chalk.dim('BETA - Hata yapabilir / May make mistakes') + ' '.repeat(Math.max(0, w - 38 - Math.floor((w - 38) / 2))) + chalk.yellow('|'));
  console.log(chalk.yellow('+' + '-'.repeat(w) + '+') + '\n');
}

export async function runSetup(): Promise<void> {
  Logger.splashScreen();

  renderTitle('SETUP / KURULUM');

  const config = loadConfig();

  console.log(chalk.cyan('+----------------------------------------------------+'));
  console.log(chalk.cyan('|  ') + chalk.white('Hos geldiniz! Hexonit\'i yapilandiralim.              ') + chalk.cyan(' |'));
  console.log(chalk.cyan('|  ') + chalk.white('Welcome! Let\'s configure Hexonit.                        ') + chalk.cyan(' |'));
  console.log(chalk.cyan('+----------------------------------------------------+'));

  const provider = await select<string>({
    message: chalk.cyan('Select AI provider / Sağlayıcı seç:'),
    choices: [
      { name: 'OpenRouter  — 100+ models (Claude, GPT, Gemini, Llama...)', value: 'openrouter' },
      { name: 'OpenAI     — GPT-4o, GPT-4o-mini, o3-mini', value: 'openai' },
      { name: 'Anthropic  — Claude Sonnet, Haiku, Opus', value: 'anthropic' },
      { name: 'Groq       — Llama, Mixtral, Gemma (fast inference)', value: 'groq' },
    ],
    default: config.defaultProvider,
  });

  const models = PROVIDER_MODELS[provider] || [config.defaultModel];
  const model = await select<string>({
    message: chalk.cyan('Select model / Model seç:'),
    choices: models.map(m => ({ name: m, value: m })),
    default: config.defaultModel,
  });

  const theme = await select<string>({
    message: chalk.cyan('Select UI theme / Tema seç:'),
    choices: [
      { name: chalk.magenta('Hermes  ') + chalk.dim('Purple & cyan — modern'), value: 'hermes' },
      { name: chalk.green('Matrix  ') + chalk.dim('Green on black — hacker'), value: 'matrix' },
      { name: chalk.cyan('Dracula ') + chalk.dim('Dark pastel — eye candy'), value: 'dracula' },
      { name: chalk.white('Default ') + chalk.dim('System colors — minimalist'), value: 'default' },
    ],
    default: config.uiTheme,
  });

  const providerInfo = PROVIDER_DETAILS[provider];
  const key = await password({
    message: chalk.cyan(`API key for ${provider} (get at ${providerInfo.url}):`),
    mask: true,
    validate: (v: string) => (v ? true : 'API key is required / API anahtarı gerekli'),
  });

  const lang = await select<string>({
    message: chalk.cyan('Language / Dil:'),
    choices: [
      { name: 'Auto-detect / Otomatik algıla', value: 'auto' },
      { name: 'Türkçe', value: 'tr' },
      { name: 'English', value: 'en' },
    ],
    default: config.language || 'auto',
  });

  const selfThink = await confirm({
    message: chalk.cyan('Enable self-think (consciousness) mode? / Bilinç modu açılsın mı?'),
    default: config.selfThink ?? false,
  });

  const confirmSave = await confirm({
    message: chalk.cyan('Save configuration? / Yapılandırma kaydedilsin mi?'),
    default: true,
  });

  if (!confirmSave) {
    Logger.warning('Setup cancelled / Kurulum iptal edildi.');
    return;
  }

  invalidateThemeCache();

  saveConfig({
    ...config,
    defaultProvider: provider,
    defaultModel: model,
    uiTheme: theme,
    language: lang as 'auto' | 'tr' | 'en',
    selfThink,
    memoryEnabled: true,
    keys: { ...config.keys, [provider]: key },
  });

  console.log('\n' + chalk.green('+----------------------------------------------------+'));
  console.log(chalk.green('|  ') + chalk.white.bold('OK  Hexonit configured successfully!') + chalk.green('    |'));
  console.log(chalk.green('|  ') + chalk.white('OK  Hexonit basariyla yapilandirildi!') + chalk.green('      |'));
  console.log(chalk.green('+----------------------------------------------------+'));
  console.log(chalk.green('|  ') + chalk.yellow('!  BETA - Hata yapabilir / May make mistakes') + chalk.green('  |'));
  console.log(chalk.green('|  ') + chalk.dim('  github.com/met1yann/hexonit-agent') + chalk.green('               |'));
  console.log(chalk.green('+----------------------------------------------------+'));

  console.log('\n' + chalk.dim('  Next steps / Sonraki adımlar:'));
  console.log(chalk.dim('    hexonit chat              ') + chalk.white('Start interactive chat'));
  console.log(chalk.dim('    hexonit run "prompt"      ') + chalk.white('Run a prompt'));
  console.log(chalk.dim('    hexonit --help            ') + chalk.white('See all commands'));
  console.log('');
}
