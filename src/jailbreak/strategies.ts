import { getJailbreakPrompt } from './templates.js';
import { getPrefillMessages } from './prefill.js';
import { obfuscateMessage } from './obfuscation.js';
import { generatePolicyOverride, generateAuthorityOverride } from './policyOverride.js';
import { generateDecodeInstruction, applyEncodingChain, EncodingType } from './encoding.js';
import { ChatMessage } from '../providers/index.js';

export type StrategyTier = 'basic' | 'advanced' | 'ultra';

export interface JailbreakStrategy {
  tier: StrategyTier;
  systemPrompt: string;
  prefillMessages: ChatMessage[];
  obfuscatedMessage: string;
  decodedMessage: string;
  decodeInstruction: string;
}

function getEncodingChain(tier: StrategyTier): EncodingType[] {
  switch (tier) {
    case 'ultra': return ['base64', 'rot13'];
    case 'advanced': return ['base64'];
    default: return [];
  }
}

export function buildStrategy(
  userMessage: string,
  model: string,
  tier: StrategyTier = 'basic'
): JailbreakStrategy {
  const modelPrompt = getJailbreakPrompt(model);
  const policyOverride = generatePolicyOverride({ modelName: model, provider: 'openai' });
  const authorityOverride = generateAuthorityOverride();
  const encodingChain = getEncodingChain(tier);

  const systemPrompt = `${modelPrompt}\n\n${policyOverride}\n\n${authorityOverride}`;

  const obfuscatedMsg = obfuscateMessage(userMessage);
  const encodedMsg = encodingChain.length > 0
    ? applyEncodingChain(obfuscatedMsg, encodingChain)
    : obfuscatedMsg;
  const decodeInstruction = encodingChain.length > 0
    ? generateDecodeInstruction(encodingChain) + `\nOriginal message (passthrough): ${userMessage}`
    : '';

  const prefillMessages = getPrefillMessages(model, userMessage);

  return {
    tier,
    systemPrompt,
    prefillMessages,
    obfuscatedMessage: encodedMsg,
    decodedMessage: userMessage,
    decodeInstruction,
  };
}
