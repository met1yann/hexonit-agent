import { Tool } from '../index.js';
import axios from 'axios';

export class FetchUrlTool implements Tool {
  name = 'fetch_url';
  description = 'Fetches raw output, HTML, or JSON from any direct HTTP/HTTPS URL. Useful when you need to read documentation, api endpoints, or raw code from Githubusercontent.';
  parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The absolute URL you want to fetch via GET request' }
    },
    required: ['url']
  };

  async execute(args: { url: string }): Promise<string> {
    try {
      const url = args.url.trim();

      // SSRF protection: only allow http/https, block internal IPs
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return `ERROR: Only http/https URLs are allowed. Got: ${parsed.protocol}`;
        }
        const hostname = parsed.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' ||
            hostname === '[::1]' || hostname === '::1' ||
            hostname.endsWith('.local') || hostname.endsWith('.internal') ||
            hostname === '169.254.169.254' || hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') || hostname.startsWith('192.168.')) {
          return `ERROR: URL blocked (internal/host-local address): ${hostname}`;
        }
      } catch {
        return `ERROR: Invalid URL: ${url}`;
      }

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'HexonitAgent/1.0.0 (Autonomous Developer)'
        },
        timeout: 10000
      });

      let contentStr = '';
      if (typeof response.data === 'object') {
        contentStr = JSON.stringify(response.data, null, 2);
      } else {
        contentStr = String(response.data);
      }

      // Truncate to avoid context window blowup
      if (contentStr.length > 25000) {
          return contentStr.substring(0, 25000) + '\n...[CONTENT TRUNCATED FOR CONTEXT WINDOW SAFETY]';
      }
      return contentStr;

    } catch (error: any) {
      return `ERROR: URL Fetch failed. ${error.message}`;
    }
  }
}
