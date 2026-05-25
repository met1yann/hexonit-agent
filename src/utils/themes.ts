import chalk from 'chalk';

export interface ThemeColors {
  primary: chalk.Chalk;
  secondary: chalk.Chalk;
  success: chalk.Chalk;
  error: chalk.Chalk;
  warning: chalk.Chalk;
  info: chalk.Chalk;
  agent: chalk.Chalk;
  border: chalk.Chalk;
  muted: chalk.Chalk;
}

export const themes: Record<string, ThemeColors> = {
  hermes: {
    primary: chalk.hex('#BB86FC'),
    secondary: chalk.hex('#03DAC6'),
    success: chalk.hex('#00FA9A'),
    error: chalk.hex('#FF4500'),
    warning: chalk.hex('#FFB6C1'),
    info: chalk.hex('#BB86FC'),
    agent: chalk.hex('#03DAC6'),
    border: chalk.hex('#BB86FC'),
    muted: chalk.hex('#666666'),
  },
  matrix: {
    primary: chalk.hex('#00FF00'),
    secondary: chalk.hex('#00CC00'),
    success: chalk.hex('#00FF00'),
    error: chalk.hex('#FF0000'),
    warning: chalk.hex('#FFFF00'),
    info: chalk.hex('#00FF00'),
    agent: chalk.hex('#00FF00'),
    border: chalk.hex('#00FF00'),
    muted: chalk.hex('#005500'),
  },
  dracula: {
    primary: chalk.hex('#BD93F9'),
    secondary: chalk.hex('#FF79C6'),
    success: chalk.hex('#50FA7B'),
    error: chalk.hex('#FF5555'),
    warning: chalk.hex('#F1FA8C'),
    info: chalk.hex('#BD93F9'),
    agent: chalk.hex('#FF79C6'),
    border: chalk.hex('#BD93F9'),
    muted: chalk.hex('#6272A4'),
  },
  default: {
    primary: chalk.cyan,
    secondary: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue,
    agent: chalk.cyan,
    border: chalk.gray,
    muted: chalk.dim,
  },
};

export function getTheme(uiTheme?: string): ThemeColors {
  return themes[uiTheme || 'default'] || themes.default;
}
