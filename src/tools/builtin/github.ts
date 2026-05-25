import { Tool } from '../index.js';
import axios from 'axios';
import { loadConfig } from '../../utils/config.js';

export class GithubSearchTool implements Tool {
  name = 'github_search';
  description = 'Searches for repositories on Github based on a query.';
  parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords (e.g. language:typescript machine-learning)' }
    },
    required: ['query']
  };

  async execute(args: { query: string }): Promise<string> {
    const config = loadConfig();
    const token = config.keys?.github;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const response = await axios.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(args.query)}&sort=stars&order=desc&per_page=5`, {
        headers,
        validateStatus: () => true // Prevent crashing on API hits
      });

      if (response.status !== 200) {
          return `Github API Error (${response.status}): ${JSON.stringify(response.data)}`;
      }

      const items = response.data.items || [];
      if (items.length === 0) return 'No repositories found for query: ' + args.query;

      const result = items.map((repo: any) =>
        `[${repo.full_name}] - Stars: ${repo.stargazers_count}\nURL: ${repo.html_url}\nDescription: ${repo.description || 'No description'}\n`
      ).join('----------------------------------\n');

      return `Top Github repositories found:\n\n${result}`;
    } catch (error: any) {
      return `ERROR: Failed to fetch Github data. ${error.message}`;
    }
  }
}
