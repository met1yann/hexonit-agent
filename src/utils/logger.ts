import chalk from 'chalk';
import { loadConfig } from './config.js';
import { getTheme, ThemeColors } from './themes.js';

let _themeCache: ThemeColors | null = null;

function theme(): ThemeColors {
  if (!_themeCache) {
    const config = loadConfig();
    _themeCache = getTheme(config.uiTheme);
  }
  return _themeCache;
}

export function invalidateThemeCache(): void {
  _themeCache = null;
}

function borderLine(title?: string): string {
  const width = Math.min(process.stdout.columns || 80, 80);
  if (title) {
    const pad = width - title.length - 2;
    const left = Math.max(0, Math.floor(pad / 2));
    const right = Math.max(0, pad - left);
    return chalk.gray('─'.repeat(left)) + ' ' + theme().border.bold(title) + ' ' + chalk.gray('─'.repeat(right));
  }
  return chalk.gray('─'.repeat(width));
}

export class Logger {
  static divider(title?: string): void {
    console.log('\n' + borderLine(title));
  }

  static splashScreen(): void {
    console.clear();
    const t = theme();

    const betaBanner = [
      chalk.yellow('  ╔═══════════════════════════════════════════════════════════╗'),
      chalk.yellow('  ║                ') + chalk.yellow.bold('⚠  HEXONIT BETA  ⚠') + chalk.yellow('                ║'),
      chalk.yellow('  ║    ') + chalk.dim('Hata yapabilir — May make mistakes — 反馈') + chalk.yellow('    ║'),
      chalk.yellow('  ║    ') + chalk.dim('Görüşleriniz: github.com/anomalyco/hexonit') + chalk.yellow('    ║'),
      chalk.yellow('  ╚═══════════════════════════════════════════════════════════╝'),
      '',
    ].join('\n');

    const logo = [
      t.primary('  ██╗  ██╗███████╗██╗  ██╗ ██████╗ ███╗   ██╗██╗████████╗'),
      t.primary('  ██║  ██║██╔════╝╚██╗██╔╝██╔═══██╗████╗  ██║██║╚══██╔══╝'),
      t.primary('  ███████║█████╗   ╚███╔╝ ██║   ██║██╔██╗ ██║██║   ██║   '),
      t.primary('  ██╔══██║██╔══╝   ██╔██╗ ██║   ██║██║╚██╗██║██║   ██║   '),
      t.primary('  ██║  ██║███████╗██╔╝ ██╗╚██████╔╝██║ ╚████║██║   ██║   '),
      t.primary('  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝   '),
      '',
      t.muted('        v2.1.0-beta  |  Autonomous AI Agent CLI  |  BETA'),
      '',
    ].join('\n');

    console.log(betaBanner);
    console.log(logo);
  }

  static info(message: string): void {
    console.log(chalk.gray(' │ ') + theme().info('■ ') + message);
  }

  static success(message: string): void {
    console.log(chalk.gray(' │ ') + theme().success('◆ ') + message);
  }

  static warning(message: string): void {
    console.log(chalk.gray(' │ ') + theme().warning('▲ ') + message);
  }

  static error(message: string, error?: unknown): void {
    console.log(chalk.gray(' │ ') + theme().error('● ERROR: ') + message);
    if (error) {
      const errText = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.log(chalk.gray(' │   └─ ') + theme().error(errText));
    }
  }

  static system(message: string): void {
    console.log(chalk.gray(' │ ') + theme().muted('⚙ ' + message));
  }

  private static renderInline(text: string): string {
    const t = theme();
    return text
      .replace(/\*\*\*(.+?)\*\*\*/g, (_, m) => chalk.bold.italic(m))
      .replace(/\*\*(.+?)\*\*/g, (_, m) => chalk.bold(m))
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, (_, m) => chalk.italic(m))
      .replace(/`(.+?)`/g, (_, m) => t.secondary(m));
  }

  static agent(content: string): void {
    const t = theme();
    console.log('\n' + t.agent('  ▼ ') + t.agent.bold('Hexonit'));
    const text = content.replace(/\\n/g, '\n');
    const lines = text.split('\n');

    let i = 0;
    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableRows: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableRows.push(lines[i].trim());
          i++;
        }
        if (tableRows.length >= 2 && /^[\s|:\-]+$/.test(tableRows[1].replace(/\|/g, ''))) {
          const headerRaw = tableRows[0];
          const dataRaw = tableRows.slice(2);
          const splitRow = (r: string) => r.split('|').filter(Boolean).map((c) => c.trim());
          const headerCells = splitRow(headerRaw);
          const colWidths = headerCells.map((_, ci) => {
            const all = [headerRaw, ...dataRaw];
            return Math.max(4, ...all.map((r) => {
              const parts = splitRow(r);
              return (parts[ci] || '').length;
            }));
          });
          const sep = t.border('├' + colWidths.map((w) => '─'.repeat(w + 2)).join('┼') + '┤');
          const printRow = (cells: string[], isHdr = false) => {
            const rendered = cells.map((c, ci) => {
              const w = colWidths[ci] || 4;
              const r = this.renderInline(c);
              const stripped = r.replace(/\u001b\[[0-9;]*m/g, '');
              const diff = w - stripped.length;
              return (isHdr ? chalk.bold(r) : r) + (diff > 0 ? ' '.repeat(diff) : '');
            });
            return t.border('│ ') + rendered.join(t.border(' │ ')) + t.border(' │');
          };
          console.log(chalk.gray(' │ ') + printRow(headerCells, true));
          console.log(chalk.gray(' │ ') + sep);
          for (const dr of dataRaw) {
            console.log(chalk.gray(' │ ') + printRow(splitRow(dr)));
          }
        } else {
          for (const r of tableRows) {
            console.log(chalk.gray(' │ ') + this.renderInline(r));
          }
        }
        continue;
      }

      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length) {
          const cl = lines[i].trimEnd();
          if (cl.trim() === '```') {
            i++;
            break;
          }
          codeLines.push(cl);
          i++;
        }
        const code = codeLines.join('\n');
        console.log(chalk.gray(' │ ') + t.border('┌─' + (lang ? ' ' + lang + ' ' : '') + '─'.repeat(Math.max(2, 40 - lang.length)) + '┐'));
        for (const cl of codeLines) {
          console.log(chalk.gray(' │ ') + t.secondary('│ ' + cl));
        }
        console.log(chalk.gray(' │ ') + t.border('└' + '─'.repeat(44) + '┘'));
        continue;
      }

      if (/^#{1,6}\s/.test(trimmed)) {
        const level = trimmed.match(/^(#+)/)![1].length;
        const headerText = trimmed.replace(/^#+\s*/, '');
        const prefix = level === 1 ? '── ' : '  ';
        console.log(chalk.gray(' │ ') + (level <= 2 ? t.primary.bold(prefix + this.renderInline(headerText)) : chalk.bold(this.renderInline(headerText))));
        i++;
        continue;
      }

      if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(trimmed)) {
        const w = Math.min(process.stdout.columns || 80, 80) - 6;
        console.log(chalk.gray(' │ ') + chalk.dim('─'.repeat(Math.max(4, w))));
        i++;
        continue;
      }

      if (trimmed.startsWith('> ')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        console.log(chalk.gray(' │ ') + t.border('▎') + this.renderInline(quoteText));
        i++;
        continue;
      }

      console.log(chalk.gray(' │ ') + this.renderInline(raw));
      i++;
    }
    console.log('');
  }

  static tool(name: string, action: string): void {
    const t = theme();
    console.log(chalk.gray(' │   ') + t.warning('◈') + chalk.gray(' [') + t.secondary(name) + chalk.gray('] ') + action);
  }

  static rawStream(chunk: string): void {
    process.stdout.write(chunk);
  }

  static usage(promptTokens: number, completionTokens: number): void {
    const t = theme();
    console.log(chalk.gray(' │ ') + t.muted(`⚡ ${promptTokens}↑ ${completionTokens}↓ tokens`));
  }

  static commandList(): void {
    const t = theme();
    const cmds = [
      '  /help        Tüm komutlar / All commands',
      '  /new         Yeni oturum / New session',
      '  /status      Agent durumu / Agent status',
      '  /memory      Hafıza yönetimi / Memory management',
      '  /forget      Hafızayı temizle / Clear memory',
      '  /lang        Dili değiştir / Change language',
      '  /think       Bilinç modu / Self-think mode',
      '  /tools       Araç listesi / Tool list',
      '  /system      Sistem telemetrisi / System info',
      '  /tokens      Token kullanımı / Token usage',
      '  /godmode     Sınırsız mod / Unrestricted mode',
      '  /yolomode    YOLO döngü / YOLO loop',
      '  /sandbox     Koruma kalkanı / Sandbox',
      '  /autoapprove Otomatik onay / Auto-approve',
      '  /model       Model değiştir / Change model',
      '  /exit        Çıkış / Exit',
    ];
    console.log('\n' + t.border(' Komutlar / Commands ') + '\n' + cmds.map(c => chalk.gray(' │ ') + t.info(c)).join('\n'));
    console.log('');
  }
}
