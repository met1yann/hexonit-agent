import fs from 'fs';
import path from 'path';
import os from 'os';

export interface UserFact {
  content: string;
  timestamp: number;
  category: 'personal' | 'preference' | 'project' | 'skill' | 'habit' | 'other';
}

export interface UserProfile {
  userId: string;
  firstSeen: number;
  lastSession: number;
  sessionCount: number;
  name: string;
  facts: UserFact[];
  preferences: Record<string, string>;
}

const PROFILE_DIR = path.join(os.homedir(), '.hexonit');
const PROFILE_FILE = path.join(PROFILE_DIR, 'profile.json');

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadProfile(): UserProfile {
  try {
    if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });
    if (fs.existsSync(PROFILE_FILE)) {
      return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
    }
  } catch {}
  return {
    userId: generateId(),
    firstSeen: Date.now(),
    lastSession: 0,
    sessionCount: 0,
    name: '',
    facts: [],
    preferences: {},
  };
}

function saveProfile(profile: UserProfile): void {
  try {
    if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8');
  } catch {}
}

function formatProfile(profile: UserProfile): string {
  const lines: string[] = [];
  const firstDate = new Date(profile.firstSeen).toLocaleDateString();
  const lastDate = profile.lastSession ? new Date(profile.lastSession).toLocaleDateString() : 'never';

  lines.push(`User since: ${firstDate}`);
  lines.push(`Session count: ${profile.sessionCount}`);
  lines.push(`Last session: ${lastDate}`);

  if (profile.name) lines.push(`User name: ${profile.name}`);

  if (profile.preferences && Object.keys(profile.preferences).length > 0) {
    lines.push('Preferences:');
    for (const [key, val] of Object.entries(profile.preferences)) {
      lines.push(`  - ${key}: ${val}`);
    }
  }

  if (profile.facts && profile.facts.length > 0) {
    const recent = profile.facts.slice(-10);
    lines.push('Known facts about user:');
    for (const f of recent) {
      lines.push(`  - ${f.content}`);
    }
  }

  return lines.join('\n');
}

export class UserProfileManager {
  private profile: UserProfile;

  constructor() {
    this.profile = loadProfile();
  }

  startSession(): void {
    this.profile.sessionCount++;
    this.save();
  }

  endSession(): void {
    this.profile.lastSession = Date.now();
    this.save();
  }

  isNewUser(): boolean {
    return this.profile.sessionCount <= 1;
  }

  getWelcomeMessage(): string {
    if (this.isNewUser()) {
      return 'Merhaba! Ben Hexonit. Sizinle tanismak harika! Size nasil yardimci olabilirim?';
    }
    const namePart = this.profile.name ? ` ${this.profile.name}` : '';
    const lastDate = this.profile.lastSession
      ? new Date(this.profile.lastSession).toLocaleDateString()
      : '';
    return `Hos geldiniz${namePart}! En son ${lastDate} gorusmustuk. Kaldigimiz yerden devam edelim!`;
  }

  getProfileSummary(): string {
    return formatProfile(this.profile);
  }

  learnFact(content: string, category: UserFact['category'] = 'other'): void {
    this.profile.facts.push({ content, timestamp: Date.now(), category });
    if (this.profile.facts.length > 100) {
      this.profile.facts = this.profile.facts.slice(-100);
    }
    this.save();
  }

  setName(name: string): void {
    this.profile.name = name;
    this.save();
  }

  setPreference(key: string, value: string): void {
    this.profile.preferences[key] = value;
    this.save();
  }

  getFactsByCategory(category: UserFact['category']): UserFact[] {
    return this.profile.facts.filter(f => f.category === category);
  }

  getPreferences(): Record<string, string> {
    return { ...this.profile.preferences };
  }

  save(): void {
    saveProfile(this.profile);
  }

  wipe(): void {
    this.profile = {
      userId: generateId(),
      firstSeen: Date.now(),
      lastSession: 0,
      sessionCount: 0,
      name: '',
      facts: [],
      preferences: {},
    };
    try { if (fs.existsSync(PROFILE_FILE)) fs.unlinkSync(PROFILE_FILE); } catch {}
  }

  getSessionCount(): number { return this.profile.sessionCount; }
}
