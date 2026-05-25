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
      const response = await axios.get(args.url, {
        headers: {
          'User-Agent': 'HexonitAgent/1.0.0 (Autonomous Developer)'
        },
        timeout: 10000 // 10 Sec Timeout Limit
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
