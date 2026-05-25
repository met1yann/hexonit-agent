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
  description = 'Full browser automation. Opens a real Chrome window. Use list_elements first to see what is on the page, then type text, click buttons, or extract data. Supports navigate, click, type, extract, screenshot, evaluate JavaScript, wait, and close.';

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
          await waitForMs(2000);
          const elements = await page.evaluate(() => {
            const items: any[] = [];

            function collect(el: Element, depth = 0): void {
              if (depth > 8) return;
              const tag = el.tagName.toLowerCase();
              const isInteract = /^(input|textarea|select|button|a)$/.test(tag) ||
                el.hasAttribute('role') || el.hasAttribute('aria-label') ||
                el.getAttribute('contenteditable') === 'true';

              if (isInteract && !el.closest('[aria-hidden="true"]')) {
                const item: any = { tag };
                if (tag === 'input') {
                  const inp = el as HTMLInputElement;
                  item.type = inp.type || 'text';
                  item.name = inp.name;
                  item.placeholder = inp.placeholder;
                }
                if (tag === 'button' || tag === 'a') {
                  item.text = (el as HTMLElement).innerText?.trim().slice(0, 80) || '';
                  const href = (el as HTMLAnchorElement).href;
                  if (href && tag === 'a') item.href = href.slice(0, 120);
                }
                if (el.getAttribute('aria-label')) item.aria = el.getAttribute('aria-label');
                if (el.hasAttribute('role')) item.role = el.getAttribute('role');
                if (el.id) {
                  item.selector = `#${el.id}`;
                } else if ((el as HTMLInputElement).name) {
                  item.selector = `${tag}[name="${(el as HTMLInputElement).name}"]`;
                } else if (el.getAttribute('aria-label')) {
                  item.selector = `${tag}[aria-label="${el.getAttribute('aria-label')}"]`;
                } else if ((el as HTMLInputElement).placeholder) {
                  item.selector = `${tag}[placeholder="${(el as HTMLInputElement).placeholder}"]`;
                } else {
                  const cls = Array.from(el.classList).slice(0, 2).join('.');
                  item.selector = cls ? `${tag}.${cls}` : tag;
                }
                items.push(item);
              }

              if (el.shadowRoot) {
                el.shadowRoot.querySelectorAll('*').forEach(child => collect(child, depth + 1));
              }
              Array.from(el.children).forEach(child => collect(child, depth + 1));
            }

            document.querySelectorAll('body *').forEach(el => collect(el));
            return items;
          });

          if (elements.length === 0) return 'No interactive elements found on this page.';

          const seen = new Set<string>();
          const unique = elements.filter(e => {
            const key = `${e.tag}:${e.selector || ''}:${e.text || ''}:${e.aria || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          let result = `Found ${unique.length} interactive elements:\n`;
          for (const el of unique.slice(0, 50)) {
            const parts: string[] = [`<${el.tag}`];
            if (el.type) parts.push(`type="${el.type}"`);
            if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
            if (el.text) parts.push(`text="${el.text}"`);
            if (el.aria) parts.push(`aria="${el.aria}"`);
            if (el.role) parts.push(`role="${el.role}"`);
            if (el.href) parts.push(`href="${el.href}"`);
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
            await waitForMs(2000);
            try { await page.waitForNavigation({ timeout: 8000 }).catch(() => {}); } catch {}
            await waitForMs(1500);
          }
          return `Typed "${args.text || ''}" into "${args.selector}"${args.submit ? ' + Enter' : ''}`;
        }

        case 'click': {
          if (!args.selector) return 'selector is required';
          const page = await ensureBrowser();
          await page.waitForSelector(args.selector, { timeout: 10000 }).catch(() => {});
          await page.click(args.selector);
          await waitForMs(1500);
          try { await page.waitForNavigation({ timeout: 8000 }).catch(() => {}); } catch {}
          await waitForMs(1000);
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
