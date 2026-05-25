# Hexonit Agent — Development Guide

Hexonit is an autonomous AI CLI agent with multi-provider support and streaming.

## Commands

- `npm install` — Install dependencies
- `npm run build` — Build with tsup (output in dist/)
- `npm run dev <command>` — Run in dev mode: `npm run dev chat` or `npm run dev setup`
- `npm start` — Run compiled version

## Architecture

### Entry Point
`src/cli/index.ts` — Commander-based CLI with setup, chat, and gateway commands.

### Agent (`src/core/agent.ts`)
`HexonitAgent` manages the autonomous loop:
- Maintains conversation history (system prompt + messages)
- Calls provider.generateResponse() for each iteration
- If the LLM requests tool calls, executes them via ToolRegistry
- Returns final response when no tool calls are made
- Supports streaming via runStream() for real-time token output
- Auto-saves sessions to ~/.hexonit/sessions/

### Provider System (`src/providers/`)
`BaseProvider` interface with `generateResponse()` and optional `generateResponseStream()`.
- **OpenRouter** — Multi-model gateway with streaming
- **OpenAI** — GPT-4o, o-series with streaming
- **Anthropic** — Claude Sonnet/Haiku with streaming
- **Groq** — Llama, Mixtral (extends OpenAI provider, different base URL)

### Tool System (`src/tools/`)
- `Tool` interface: name, description, parameters schema, execute()
- `ToolRegistry`: register, lookup, execute with timeout (default 60s)
- Built-in tools: execute_bash, read_file, write_file, web_search, github_search, telegram_send, system_info, fetch_url, list_dir

### UI / Theming (`src/utils/`)
- `themes.ts` — Theme definitions (hermes, matrix, dracula, default)
- `logger.ts` — Structured output with theme-aware colors, no chalk-animation
- `config.ts` — Config with env var overrides

## Adding a New Tool
1. Create `src/tools/builtin/<name>.ts` implementing `Tool`
2. Register in `src/cli/index.ts` via `registry.register(new YourTool())`

## Adding a New Provider
1. Create `src/providers/<name>.ts` implementing `BaseProvider`
2. Add to `PROVIDER_MAP` in `src/cli/index.ts`
3. Add key handling in `src/utils/config.ts` and `src/cli/setup.ts`
