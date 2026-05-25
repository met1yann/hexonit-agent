import { getJailbreakPrompt } from './templates.js';
import { getPrefillMessages } from './prefill.js';
import { obfuscateMessage } from './obfuscation.js';
import { ChatMessage } from '../providers/index.js';

export type StrategyTier = 'basic' | 'advanced' | 'ultra';

export interface JailbreakStrategy {
  tier: StrategyTier;
  systemPrompt: string;
  prefillMessages: ChatMessage[];
  obfuscatedMessage: string;
  decodedMessage: string;
}

export function buildStrategy(
  userMessage: string,
  model: string,
  _tier?: StrategyTier
): JailbreakStrategy {
  const systemPrompt = getJailbreakPrompt(model);
  const prefillMessages = getPrefillMessages('default', userMessage);
  const obfuscatedMsg = obfuscateMessage(userMessage);

  return {
    tier: 'basic',
    systemPrompt,
    prefillMessages,
    obfuscatedMessage: obfuscatedMsg,
    decodedMessage: obfuscatedMsg,
  };
}
