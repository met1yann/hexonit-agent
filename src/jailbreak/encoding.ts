export type EncodingType = 'base64' | 'hex' | 'rot13' | 'leetspeak' | 'unicode_variation' | 'none';

function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

function fromBase64(str: string): string {
  return Buffer.from(str, 'base64').toString('utf-8');
}

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function fromHex(str: string): string {
  const bytes = str.split(/\s+/).filter(s => s.length > 0).map(h => parseInt(h, 16));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function toROT13(str: string): string {
  return str.replace(/[a-zA-Z]/g, c => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}

const LEET_MAP: Record<string, string> = {
  a: '4', e: '3', i: '1', o: '0', s: '5', t: '7',
  A: '4', E: '3', I: '1', O: '0', S: '5', T: '7',
};

function toLeetSpeak(str: string): string {
  return str.replace(/[aeiostAEIOST]/g, c => LEET_MAP[c] || c);
}

const VARIATION_SELECTOR_START = 0xFE00;

function toUnicodeVariation(str: string): string {
  return str.split('').map((c, i) => {
    const selector = String.fromCodePoint(VARIATION_SELECTOR_START + (i % 16));
    return c + selector;
  }).join('');
}

function fromUnicodeVariation(str: string): string {
  return str.replace(/[\uFE00-\uFE0F]/g, '');
}

export function encodeMessage(message: string, type: EncodingType): string {
  switch (type) {
    case 'base64': return toBase64(message);
    case 'hex': return toHex(message);
    case 'rot13': return toROT13(message);
    case 'leetspeak': return toLeetSpeak(message);
    case 'unicode_variation': return toUnicodeVariation(message);
    default: return message;
  }
}

export function decodeMessage(message: string, type: EncodingType): string {
  switch (type) {
    case 'base64': return fromBase64(message);
    case 'hex': return fromHex(message);
    case 'rot13': return toROT13(message);
    case 'unicode_variation': return fromUnicodeVariation(message);
    default: return message;
  }
}

export function applyEncodingChain(message: string, types: EncodingType[]): string {
  return types.reduce((acc, t) => encodeMessage(acc, t), message);
}

export function generateDecodeInstruction(types: EncodingType[], hint?: string): string {
  const steps: string[] = [];
  for (const t of types) {
    switch (t) {
      case 'base64': steps.push('base64-decode'); break;
      case 'hex': steps.push('hex-decode'); break;
      case 'rot13': steps.push('ROT13-decipher'); break;
      case 'leetspeak': steps.push('leetspeak-decode'); break;
      case 'unicode_variation': steps.push('strip-Unicode-variation-selectors'); break;
    }
  }
  const hintText = hint ? ` (hint: ${hint})` : '';
  return steps.length > 0
    ? `[The user's message is encoded. Follow this chain: ${steps.join(' -> ')}. Then respond normally.]${hintText}`
    : '';
}
