import { Tool } from '../index.js';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

let browserInstance: Browser | null = null;
let activePage: Page | null = null;

function findChrome(): string {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${os.homedir()}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const which = execSync('which google-chrome || which chromium-browser || which chromium 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (which) return which;
  } catch {}
  return 'chrome';
}

async function ensureBrowser(): Promise<Page> {
  if (browserInstance && activePage) {
    try {
      await activePage.evaluate(() => 1);
      return activePage;
    } catch {}
  }
  if (browserInstance) {
    try { await browserInstance.close(); } catch {}
    browserInstance = null;
  }
  const chromePath = findChrome();
  const headless = process.env.HEXONIT_BROWSER_HEADLESS === 'true' ? 'new' : false;
  browserInstance = await puppeteer.launch({
    executablePath: chromePath,
    headless,
    args: ['--start-maximized', '--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const pages = await browserInstance.pages();
  activePage = pages[0] || (await browserInstance.newPage());
  await activePage.setViewport({ width: 1280, height: 800 });
  return activePage;
}

function truncate(text: string, max = 4000): string {
  return text.length > max ? text.slice(0, max) + '\n... [truncated]' : text;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try { await browserInstance.close(); } catch {}
    browserInstance = null;
    activePage = null;
  }
}

export class BrowserTool implements Tool {
  closeBrowser = closeBrowser;
  name = 'browser';
  description = `Full browser automation. Opens REAL Chrome window on your screen. Use list_elements first to discover what's on the page, then type/click/extract.

WORKFLOW:
1. navigate to a URL
2. list_elements to see all inputs, buttons, links
3. type text into an input (use the "selector" from list_elements)
4. click a button
5. extract results

For Google search: input name is "q". For most sites, try input[type="search"], input[placeholder*="ara"], input[placeholder*="search"]`;

  parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action: navigate, list_elements, type, click, extract, screenshot, evaluate, close, wait',
        enum: ['navigate', 'list_elements', 'type', 'click', 'extract', 'screenshot', 'evaluate', 'close', 'wait'],
      },
      url: { type: 'string', description: 'URL for navigate action' },
      selector: { type: 'string', description: 'CSS selector for type/click/extract. Get this from list_elements output.' },
      text: { type: 'string', description: 'Text to type (for type action)' },
      submit: { type: 'boolean', description: 'Press Enter after typing' },
      script: { type: 'string', description: 'JavaScript code for evaluate action' },
      ms: { type: 'number', description: 'Milliseconds to wait (for wait action)' },
    },
    required: ['action'],
  };

  async execute(args: {
    action: string;
    url?: string;
    selector?: string;
    text?: string;
    submit?: boolean;
    script?: string;
    ms?: number;
  }): Promise<string> {
    try {
      switch (args.action) {

        case 'navigate': {
          if (!args.url) return 'url is required';
          const page = await ensureBrowser();
          await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 30000 });
          return `Navigated to ${args.url}`;
        }

        case 'list_elements': {
          const page = await ensureBrowser();
          await waitForMs(1500);
          const elements = await page.evaluate(() => {
            const items: { tag: string; type?: string; name?: string; id?: string; placeholder?: string; text?: string; selector: string; role?: string; aria?: string }[] = [];

            document.querySelectorAll('input, textarea, select, button, a, [role="button"], [role="searchbox"], [contenteditable]').forEach((el) => {
              const tag = el.tagName.toLowerCase();
              const item: any = { tag };
              if (tag === 'input') {
                const input = el as HTMLInputElement;
                item.type = input.type || 'text';
                item.name = input.name;
                item.id = input.id;
                item.placeholder = input.placeholder;
                if (input.getAttribute('aria-label')) item.aria = input.getAttribute('aria-label');
                if (input.getAttribute('data-testid')) item['data-testid'] = input.getAttribute('data-testid');
                if (input.getAttribute('data-test-id')) item['data-test-id'] = input.getAttribute('data-test-id');
              }
              if (tag === 'textarea') {
                const ta = el as HTMLTextAreaElement;
                item.name = ta.name;
                item.id = ta.id;
                item.placeholder = ta.placeholder;
              }
              if (tag === 'button' || tag === 'a') {
                item.text = (el as HTMLElement).innerText?.trim().slice(0, 60) || '';
                item.id = el.id;
                if (el.getAttribute('aria-label')) item.aria = el.getAttribute('aria-label');
              }
              if (el.hasAttribute('role')) item.role = el.getAttribute('role');
              if (el.id) {
                item.selector = `#${el.id}`;
              } else if ((el as HTMLInputElement).name) {
                item.selector = `${tag}[name="${(el as HTMLInputElement).name}"]`;
              } else if ((el as HTMLInputElement).placeholder) {
                item.selector = `${tag}[placeholder="${(el as HTMLInputElement).placeholder}"]`;
              } else if (el.getAttribute('aria-label')) {
                item.selector = `${tag}[aria-label="${el.getAttribute('aria-label')}"]`;
              } else {
                item.selector = el.tagName.toLowerCase();
              }
              items.push(item);
            });
            return items;
          });

          if (elements.length === 0) return 'No interactive elements found on this page.';
          let result = `Found ${elements.length} interactive elements:\n`;
          for (const el of elements.slice(0, 40)) {
            const parts = [`<${el.tag}`];
            if (el.type) parts.push(`type="${el.type}"`);
            if (el.name) parts.push(`name="${el.name}"`);
            if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
            if (el.text) parts.push(`text="${el.text}"`);
            if (el.aria) parts.push(`aria="${el.aria}"`);
            if (el.role) parts.push(`role="${el.role}"`);
            result += `  SELECTOR: ${el.selector}  ${parts.join(' ')}\n`;
          }
          return truncate(result);
        }

        case 'type': {
          if (!args.selector) return 'selector is required for type';
          const page = await ensureBrowser();
          await page.waitForSelector(args.selector, { timeout: 8000 }).catch(() => {});
          try {
            await page.click(args.selector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
          } catch {
            await page.focus(args.selector).catch(() => {});
          }
          await waitForMs(200);
          if (args.text) {
            await page.type(args.selector, args.text, { delay: 30 });
          }
          if (args.submit) {
            await waitForMs(400);
            await page.keyboard.press('Enter');
          }
          return `Typed "${args.text || ''}" into "${args.selector}"${args.submit ? ' + Enter' : ''}`;
        }

        case 'click': {
          if (!args.selector) return 'selector is required';
          const page = await ensureBrowser();
          await page.waitForSelector(args.selector, { timeout: 8000 }).catch(() => {});
          await page.click(args.selector);
          await waitForMs(1500);
          return `Clicked "${args.selector}"`;
        }

        case 'extract': {
          const page = await ensureBrowser();
          if (args.selector) {
            await page.waitForSelector(args.selector, { timeout: 6000 }).catch(() => {});
            const text = await page.$eval(args.selector, (el) => (el as HTMLElement).innerText).catch(() => '');
            if (text) return truncate(`From "${args.selector}":\n${text}`);
          }
          const bodyText = await page.evaluate(() => document.body?.innerText || '');
          return truncate(`Page text:\n${bodyText}`);
        }

        case 'screenshot': {
          const page = await ensureBrowser();
          const dir = path.join(os.tmpdir(), 'hexonit-screenshots');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const filePath = path.join(dir, `screenshot-${Date.now()}.png`);
          await page.screenshot({ path: filePath, fullPage: false });
          return `Screenshot saved: ${filePath}`;
        }

        case 'evaluate': {
          if (!args.script) return 'script is required';
          const page = await ensureBrowser();
          const result = await page.evaluate(args.script);
          const str = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
          return truncate(`Result:\n${str}`);
        }

        case 'wait': {
          const ms = args.ms || 2000;
          await waitForMs(ms);
          return `Waited ${ms}ms`;
        }

        case 'close': {
          if (browserInstance) {
            await browserInstance.close();
            browserInstance = null;
            activePage = null;
          }
          return 'Browser closed';
        }

        default:
          return `Unknown action "${args.action}". Use: navigate, list_elements, type, click, extract, screenshot, evaluate, wait, close`;
      }
    } catch (error: any) {
      return `Browser ${args.action} failed: ${error.message}`;
    }
  }
}

function waitForMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
