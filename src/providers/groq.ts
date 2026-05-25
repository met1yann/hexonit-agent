import { OpenAIProvider } from './openai.js';

export class GroqProvider extends OpenAIProvider {
  name = 'groq';

  constructor(apiKey: string, defaultModel = 'llama-3.3-70b-versatile') {
    super(apiKey, defaultModel, 'https://api.groq.com/openai/v1');
  }
}
