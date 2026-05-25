import axios from 'axios';
import { Tool } from '../index.js';

export class WebSearchTool implements Tool {
  name = 'web_search';
  description = 'Performs a web search using DuckDuckGo to get real-time information from the internet. Use this when you do not possess the knowledge or need up-to-date documentation.';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web.',
      },
    },
    required: ['query'],
  };

  async execute(args: { query: string }): Promise<string> {
    try {
      // Using DuckDuckGo HTML Lite version for scraping text-based results easily
      const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: { q: args.query },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HexonitAgent/1.0',
        },
      });

      // A simple regex approach to extract Result Snippets from DDG HTML
      const html = response.data;
      const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/g;

      let matches;
      const results: string[] = [];
      let count = 0;

      while ((matches = snippetRegex.exec(html)) !== null && count < 5) {
        // Strip out bold tags and decode entities manually
        let cleanText = matches[1]
            .replace(/<b>/g, '')
            .replace(/<\/b>/g, '')
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"');
        results.push(`- ${cleanText.trim()}`);
        count++;
      }

      if (results.length === 0) return 'No relevant web search results found.';

      return `Web Search Results for "${args.query}":\n\n${results.join('\n')}`;
    } catch (error: any) {
      return `Failed to fetch web results: ${error.message}`;
    }
  }
}
