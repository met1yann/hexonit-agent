import axios from 'axios';
import { BaseProvider, ChatMessage, ProviderResponse, ProviderStreamEvent } from './index.js';
import { Tool } from '../tools/index.js';
import { Logger } from '../utils/logger.js';

export class AnthropicProvider implements BaseProvider {
  name = 'anthropic';
  supportsStreaming = true;
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = 'claude-sonnet-4-20250514') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  private toAnthropicMessages(messages: ChatMessage[]) {
    const result: any[] = [];
    let systemContent = '';
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemContent += (systemContent ? '\n' : '') + msg.content;
        continue;
      }
      const entry: any = { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content };
      result.push(entry);
    }
    return { messages: result, system: systemContent || undefined };
  }

  private buildTools(tools: Tool[]) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  async generateResponse(
    messages: ChatMessage[],
    tools: Tool[],
    model?: string,
    options?: { signal?: AbortSignal }
  ): Promise<ProviderResponse> {
    const { messages: msgs, system } = this.toAnthropicMessages(messages);
    const formattedTools = this.buildTools(tools);
    try {
      const body: any = {
        model: model || this.defaultModel,
        max_tokens: 4096,
        messages: msgs,
      };
      if (system) body.system = system;
      if (formattedTools.length > 0) body.tools = formattedTools;

      const res = await axios.post('https://api.anthropic.com/v1/messages', body, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        signal: options?.signal,
      });

      const data = res.data;
      const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
      const toolCalls: any[] = [];
      for (const block of data.content || []) {
        if (block.type === 'text') {
          assistantMsg.content += block.text;
        }
        if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function' as const,
            function: { name: block.name, arguments: JSON.stringify(block.input) },
          });
        }
      }
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;

      return {
        message: assistantMsg,
        usage: data.usage
          ? { promptTokens: data.usage.input_tokens || 0, completionTokens: data.usage.output_tokens || 0 }
          : undefined,
      };
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const msg = error.response.data?.error?.message || 'Unknown error';
        if (status === 429) {
          Logger.warning('Anthropic: rate limited (429). Pausing.');
          throw new Error('Rate limit exceeded');
        }
        throw new Error(`Anthropic API [${status}]: ${msg}`);
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
    const { messages: msgs, system } = this.toAnthropicMessages(messages);
    const formattedTools = this.buildTools(tools);
    try {
      const body: any = {
        model: model || this.defaultModel,
        max_tokens: 4096,
        messages: msgs,
        stream: true,
      };
      if (system) body.system = system;
      if (formattedTools.length > 0) body.tools = formattedTools;

      const res = await axios.post('https://api.anthropic.com/v1/messages', body, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        signal: options?.signal,
        adapter: 'http',
      });

      let buffer = '';
      let contentAccum = '';

      for await (const chunk of res.data) {
        const decoded = chunk.toString('utf-8');
        buffer += decoded;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              contentAccum += parsed.delta.text;
              yield { type: 'delta', delta: parsed.delta.text };
            }
            if (parsed.type === 'message_stop') {
              yield { type: 'done' };
              return;
            }
          } catch {
            // skip
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
