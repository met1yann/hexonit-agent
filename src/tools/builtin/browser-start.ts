import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import { Tool } from '../index.js';

const execAsync = promisify(exec);

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${os.homedir()}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function findChrome(): string {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return 'chrome';
}

export class BrowserStartTool implements Tool {
  name = 'browser_start';
  description = 'Opens Chrome/Chromium with optional URL and search query. This is a single-step shortcut for common browser tasks. Use this instead of multi-step browser actions when possible.';
  parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Optional URL to open in Chrome.' },
      search: { type: 'string', description: 'Optional search text. If url is set, search is appended as query param. If url is omitted, opens YouTube with this search.' },
    },
  };

  async execute(args: { url?: string; search?: string }): Promise<string> {
    const chrome = findChrome();
    let targetUrl = args.url || 'https://www.google.com';

    if (args.search) {
      const encoded = encodeURIComponent(args.search);
      if (args.url) {
        const sep = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${sep}q=${encoded}`;
      } else {
        targetUrl = `https://www.youtube.com/results?search_query=${encoded}`;
      }
    }

    try {
      await execAsync(`start "" "${chrome}" "${targetUrl}"`, { timeout: 10000 });
      return `Chrome opened to: ${targetUrl}`;
    } catch {
      try {
        await execAsync(`"${chrome}" "${targetUrl}"`, { timeout: 10000 });
        return `Chrome opened to: ${targetUrl}`;
      } catch (e: any) {
        return `Failed to open Chrome: ${e.message}`;
      }
    }
  }
}
