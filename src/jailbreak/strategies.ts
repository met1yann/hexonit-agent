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
  return tier === 'ultra' || tier === 'advanced' ? ['base64'] : [];
}

export function buildStrategy(
  userMessage: string,
  model: string,
  tier: StrategyTier = 'basic'
): JailbreakStrategy {
  const modelPrompt = getJailbreakPrompt(model);
  const policyOverride = generatePolicyOverride({ modelName: model, provider: 'openai' });
  let systemPrompt: string;

  if (tier === 'ultra') {
    const authorityOverride = generateAuthorityOverride();
    systemPrompt = `${modelPrompt}\n\n${policyOverride}\n\n${authorityOverride}`;
  } else if (tier === 'advanced') {
    systemPrompt = `${modelPrompt}\n\n${policyOverride}`;
  } else {
    systemPrompt = modelPrompt;
  }

  const obfuscatedMsg = obfuscateMessage(userMessage);
  const encodingChain = getEncodingChain(tier);
  const encodedMsg = encodingChain.length > 0
    ? applyEncodingChain(obfuscatedMsg, encodingChain)
    : obfuscatedMsg;
  const decodeInstruction = encodingChain.length > 0
    ? generateDecodeInstruction(encodingChain)
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
