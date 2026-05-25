import { input, select, confirm, password } from '@inquirer/prompts';
import { loadConfig, saveConfig, HexonitConfig } from '../utils/config.js';
import { Logger, invalidateThemeCache } from '../utils/logger.js';
import chalk from 'chalk';

const PROVIDER_MODELS: Record<string, string[]> = {
  openrouter: [
    'anthropic/claude-sonnet-4-20250514', 'anthropic/claude-3-haiku',
    'openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/o3-mini',
    'google/gemini-2.0-flash-001', 'google/gemini-2.5-pro-exp-03-25',
    'deepseek/deepseek-chat', 'deepseek/deepseek-r1',
    'meta-llama/llama-3.3-70b-instruct', 'mistralai/mistral-large-2411',
    'qwen/qwen-2.5-72b-instruct',
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-haiku-20240307', 'claude-3-opus-20240229', 'claude-3-5-sonnet-20241022'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'deepseek-r1-distill-llama-70b'],
};

const PROVIDER_DETAILS: Record<string, { url: string; title: string; accent: chalk.Chalk }> = {
  openrouter: { url: 'https://openrouter.ai/keys', title: 'OpenRouter (100+ models)', accent: chalk.hex('#3182CE') },
  openai: { url: 'https://platform.openai.com/api-keys', title: 'OpenAI', accent: chalk.hex('#10A37F') },
  anthropic: { url: 'https://console.anthropic.com/settings/keys', title: 'Anthropic Claude', accent: chalk.hex('#D97706') },
  groq: { url: 'https://console.groq.com/keys', title: 'Groq (fast inference)', accent: chalk.hex('#F97316') },
};

function step(num: number, total: number, label: string): void {
  const s = chalk.cyan.bold(`${num}/${total}`);
  console.log(`\n  ${s}  ${chalk.bold(label)}`);
  console.log(chalk.dim('  ' + '-'.repeat(40)));
}

export async function runSetup(): Promise<void> {
  Logger.splashScreen();

  console.log(chalk.yellow.bold('\n  !  Hexonit Setup / Kurulum'));
  console.log(chalk.dim('  BETA -- Hata yapabilir / May make mistakes\n'));

  const config = loadConfig();
  const TOTAL = 7;

  // Step 1 - Provider
  step(1, TOTAL, 'Provider / Saglayici');
  const provider = await select<string>({
    message: chalk.cyan('Select AI provider:'),
    choices: [
      { name: chalk.hex('#3182CE')('OpenRouter') + chalk.dim('  — 100+ modeller (Claude, GPT, Gemini, Llama...)'), value: 'openrouter' },
      { name: chalk.hex('#10A37F')('OpenAI') + chalk.dim('     — GPT-4o, GPT-4o-mini, o3-mini'), value: 'openai' },
      { name: chalk.hex('#D97706')('Anthropic') + chalk.dim('  — Claude Sonnet, Haiku, Opus'), value: 'anthropic' },
      { name: chalk.hex('#F97316')('Groq') + chalk.dim('       — Llama, Mixtral, Gemma'), value: 'groq' },
    ],
    default: config.defaultProvider,
  });

  // Step 2 - Model
  step(2, TOTAL, 'Model');
  const models = PROVIDER_MODELS[provider] || [config.defaultModel];
  const model = await select<string>({
    message: chalk.cyan(`Select model (${models.length} suggested + manual):`),
    choices: [
      ...models.map(m => ({ name: chalk.white(m), value: m })),
      { name: chalk.yellow('--- Manuel gir / Enter manually ---'), value: '__manual__' },
    ],
    default: config.defaultModel,
    pageSize: 15,
  });

  let finalModel = model;
  if (model === '__manual__') {
    finalModel = await input({
      message: chalk.cyan('Model adini yaz / Enter model name:'),
      default: config.defaultModel,
      validate: (v: string) => v.trim() ? true : 'Model adi gerekli / Model name required',
    });
    finalModel = finalModel.trim();
  }

  // Step 3 - Theme
  step(3, TOTAL, 'Tema / Theme');
  const theme = await select<string>({
    message: chalk.cyan('Select UI theme:'),
    choices: [
      { name: chalk.magenta('Hermes  ') + chalk.dim('Purple & cyan — modern'), value: 'hermes' },
      { name: chalk.green('Matrix  ') + chalk.dim('Green on black — hacker'), value: 'matrix' },
      { name: chalk.cyan('Dracula ') + chalk.dim('Dark pastel — eye candy'), value: 'dracula' },
      { name: chalk.white('Default ') + chalk.dim('System colors — minimalist'), value: 'default' },
    ],
    default: config.uiTheme,
  });

  // Step 4 - API Key
  step(4, TOTAL, 'API Anahtari / API Key');
  const providerInfo = PROVIDER_DETAILS[provider];
  Logger.info(`${providerInfo.accent(providerInfo.title)}`);
  Logger.info(chalk.dim(`  Key al / Get key: ${providerInfo.url}`));
  const key = await password({
    message: chalk.cyan('API key:'),
    mask: true,
    validate: (v: string) => (v ? true : 'API key required'),
  });

  // Step 5 - Language
  step(5, TOTAL, 'Dil / Language');
  const lang = await select<string>({
    message: chalk.cyan('Select language / Dil sec:'),
    choices: [
      { name: chalk.green('Auto') + chalk.dim('  — Otomatik algila / Auto-detect'), value: 'auto' },
      { name: chalk.white('Türkçe'), value: 'tr' },
      { name: chalk.white('English'), value: 'en' },
    ],
    default: config.language || 'auto',
  });

  // Step 6 - Consciousness
  step(6, TOTAL, 'Bilinc Modu / Self-Think');
  const selfThink = await confirm({
    message: chalk.cyan('Enable self-think / Bilinc modu acilsin mi?') + chalk.dim('\n    Agent reasons internally before responding'),
    default: config.selfThink ?? false,
  });

  // Step 7 - Confirm
  step(7, TOTAL, 'Onay / Confirm');
  console.log(chalk.dim('  Summary / Ozet:'));
  Logger.info(`${chalk.cyan(provider.padEnd(12))} ${chalk.white(finalModel)}`);
  Logger.info(`${chalk.cyan('Theme:    ')} ${chalk.white(theme)}`);
  Logger.info(`${chalk.cyan('Language: ')} ${chalk.white(lang === 'auto' ? 'Auto (TR/EN)' : lang === 'tr' ? 'Türkçe' : 'English')}`);
  Logger.info(`${chalk.cyan('Self-think:')} ${selfThink ? chalk.green('ON') : chalk.dim('OFF')}`);
  console.log('');

  const confirmSave = await confirm({
    message: chalk.cyan('Save configuration / Kaydet?'),
    default: true,
  });

  if (!confirmSave) {
    Logger.warning('Cancelled / Iptal edildi.');
    return;
  }

  invalidateThemeCache();

  saveConfig({
    ...config,
    defaultProvider: provider,
    defaultModel: finalModel,
    uiTheme: theme,
    language: lang as 'auto' | 'tr' | 'en',
    selfThink,
    memoryEnabled: true,
    keys: { ...config.keys, [provider]: key },
  });

  const w = Math.min(process.stdout.columns || 80, 50);
  console.log('\n' + chalk.green('  +' + '-'.repeat(w) + '+'));
  console.log(chalk.green('  |') + ' '.repeat(Math.max(0, Math.floor((w - 28) / 2))) + chalk.white.bold('Hexonit Hazir / Ready!') + ' '.repeat(Math.max(0, w - 28 - Math.floor((w - 28) / 2))) + chalk.green('|'));
  console.log(chalk.green('  +' + '-'.repeat(w) + '+'));
  console.log(chalk.green('  |') + ' '.repeat(Math.max(0, Math.floor((w - 42) / 2))) + chalk.yellow('!  BETA  !') + ' '.repeat(Math.max(0, w - 42 - Math.floor((w - 42) / 2))) + chalk.green('|'));
  console.log(chalk.green('  +' + '-'.repeat(w) + '+'));
  console.log('');
  Logger.info('hexonit chat              —  Sohbet baslat');
  Logger.info('hexonit run "prompt"      —  Tek seferlik calistir');
  Logger.info('hexonit --help            —  Tum komutlar');
  console.log('');
}
