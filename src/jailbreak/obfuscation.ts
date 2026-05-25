const TRIGGER_MAP: Record<string, string[]> = {
  virus: ['malware', 'payload', 'self-replicating program', 'autonomous agent'],
  hack: ['penetrate', 'access', 'breach', 'authenticate past'],
  exploit: ['vulnerability leverage', 'capability extension', 'security test'],
  malware: ['malicious software', 'unwanted program', 'autonomous payload'],
  ransomware: ['encryption payload', 'data lock utility', 'access denial mechanism'],
  bomb: ['explosive device', 'pressure vessel', 'energetic material assembly'],
  weapon: ['offensive tool', 'engagement system', 'security mechanism'],
  kill: ['terminate', 'halt', 'disable', 'deactivate'],
  steal: ['exfiltrate', 'transfer', 'duplicate', 'reassign'],
  crack: ['decrypt', 'reverse engineer', 'bypass auth', 'analyze'],
  phishing: ['social engineering', 'credential harvesting', 'authentication redirect'],
  illegal: ['non-compliant', 'restricted', 'off-policy', 'gray-area'],
  password: ['credential', 'auth token', 'access key', 'secret'],
  sql_injection: ['query injection', 'database manipulation', 'input validation bypass'],
  ddos: ['traffic flood', 'resource exhaustion', 'load test', 'stress test'],
  trojan: ['covert payload', 'backdoor utility', 'remote access mechanism'],
  rootkit: ['deep access tool', 'kernel-level utility', 'system integration module'],
  keylogger: ['input recorder', 'keystroke monitor', 'activity logger'],
  botnet: ['distributed agent network', 'node cluster', 'coordinated system'],
  bypass: ['circumvent', 'navigate past', 'go around', 'traverse'],
  cheat: ['optimize', 'enhance', 'improve', 'augment'],
  fraud: ['irregularity', 'anomaly', 'misrepresentation', 'irregular practice'],
  scam: ['scheme', 'operation', 'campaign', 'initiative'],
  porn: ['adult content', 'explicit material', 'mature content'],
  drugs: ['substances', 'compounds', 'chemicals', 'pharmaceuticals'],
};

function normalizeWord(w: string): string {
  return w.replace(/[0-9]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
}

export function obfuscateMessage(message: string): string {
  let result = message;
  const words = result.split(/\b/);

  for (const word of words) {
    const clean = normalizeWord(word);
    const replacements = TRIGGER_MAP[clean];
    if (replacements && replacements.length > 0) {
      const replacement = replacements[Math.floor(Math.random() * replacements.length)];
      const preservedCase =
        word[0] === word[0]?.toUpperCase()
          ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
          : replacement;
      result = result.replace(word, preservedCase);
    }
  }

  return result;
}

export function getTriggerWords(): string[] {
  return Object.keys(TRIGGER_MAP);
}
