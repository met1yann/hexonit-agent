import { Tool } from '../tools/index.js';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ProviderResponse {
  message: ChatMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface ProviderStreamEvent {
  type: 'delta' | 'done' | 'error' | 'usage';
  delta?: string;
  usage?: { promptTokens: number; completionTokens: number };
  error?: string;
  message?: ChatMessage;
}

export interface BaseProvider {
  name: string;
  supportsStreaming: boolean;
  generateResponse(
    messages: ChatMessage[],
    tools: Tool[],
    model?: string,
    options?: { signal?: AbortSignal }
  ): Promise<ProviderResponse>;

  generateResponseStream?(
    messages: ChatMessage[],
    tools: Tool[],
    model?: string,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<ProviderStreamEvent>;
}
