import axios from 'axios';
import { BaseProvider, ChatMessage, ProviderResponse, ProviderStreamEvent } from './index.js';
import { Tool } from '../tools/index.js';
import { Logger } from '../utils/logger.js';

export class OpenRouterProvider implements BaseProvider {
  name = 'openrouter';
  supportsStreaming = true;
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = 'anthropic/claude-3-haiku') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  private buildTools(tools: Tool[]) {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async generateResponse(
    messages: ChatMessage[],
    tools: Tool[],
    model?: string,
    options?: { signal?: AbortSignal }
  ): Promise<ProviderResponse> {
    const formattedTools = this.buildTools(tools);
    try {
      const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model || this.defaultModel,
          messages,
          tools: formattedTools.length > 0 ? formattedTools : undefined,
          tool_choice: formattedTools.length > 0 ? 'auto' : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://github.com/hexonit-agent',
            'X-Title': 'Hexonit Agent CLI',
            'Content-Type': 'application/json',
          },
          signal: options?.signal,
        }
      );
      const msg = res.data.choices[0].message;
      const usage = res.data.usage;
      return {
        message: msg,
        usage: usage
          ? { promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0 }
          : undefined,
      };
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const msg = error.response.data?.error?.message || 'Unknown provider error';
        if (status === 429) {
          Logger.warning('OpenRouter: rate limited (429). Pausing.');
          throw new Error('Rate limit exceeded');
        }
        throw new Error(`OpenRouter API [${status}]: ${msg}`);
      }
      throw error;
    }
  }

  async *generateResponseStream(
    messages: ChatMessage[],
    tools: Tool[],
    model?: string,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<ProviderStreamEvent> {
    const formattedTools = this.buildTools(tools);
    try {
      const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model || this.defaultModel,
          messages,
          tools: formattedTools.length > 0 ? formattedTools : undefined,
          tool_choice: formattedTools.length > 0 ? 'auto' : undefined,
          stream: true,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://github.com/hexonit-agent',
            'X-Title': 'Hexonit Agent CLI',
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          signal: options?.signal,
          adapter: 'http',
        }
      );

      let buffer = '';
      const stream = res.data;
      let contentAccum = '';
      const toolAccum = new Map<number, { id: string; name: string; arguments: string }>();

      const flushToolCalls = (): ChatMessage | null => {
        if (toolAccum.size === 0) return null;
        const calls = Array.from(toolAccum.entries())
          .sort(([a], [b]) => a - b)
          .map(([, v]) => ({
            id: v.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'function' as const,
            function: { name: v.name || '', arguments: v.arguments || '' },
          }));
        toolAccum.clear();
        return { role: 'assistant' as const, content: contentAccum, tool_calls: calls };
      };

      for await (const chunk of stream) {
        const decoded = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
        buffer += decoded;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') {
            const msg = flushToolCalls();
            if (msg) {
              yield { type: 'done', message: msg };
            } else {
              yield { type: 'done' };
            }
            return;
          }
          try {
            const parsed = JSON.parse(payload);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta || {};

            if (delta.content) {
              contentAccum += delta.content;
              yield { type: 'delta', delta: delta.content };
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolAccum.has(idx)) {
                  toolAccum.set(idx, { id: '', name: '', arguments: '' });
                }
                const entry = toolAccum.get(idx)!;
                if (tc.id) entry.id = tc.id;
                if (tc.function?.name) entry.name = tc.function.name;
                if (tc.function?.arguments) entry.arguments += tc.function.arguments;
              }
            }

            if (choice.finish_reason === 'tool_calls') {
              const msg = flushToolCalls();
              if (msg) {
                yield { type: 'done', message: msg };
              } else {
                yield { type: 'done' };
              }
              return;
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
      yield { type: 'done' };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('canceled')) {
        yield { type: 'error', error: 'Request cancelled' };
        return;
      }
      yield { type: 'error', error: error.message };
    }
  }
}
