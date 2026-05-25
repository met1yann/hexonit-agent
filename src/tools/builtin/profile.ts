import { Tool } from '../index.js';
import { UserProfileManager } from '../../core/profile.js';

export class ProfileTool implements Tool {
  name = 'update_profile';
  description = 'Save information about the user to persistent memory (cross-session). Call this when the user shares their name, preferences, projects, or any personal details you should remember forever. The profile persists across all sessions.';
  parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add_fact', 'set_name', 'set_preference'],
        description: 'What to do: add_fact (learn something), set_name (save user name), set_preference (save preference)',
      },
      fact: { type: 'string', description: 'The fact/content to remember (for add_fact action)' },
      category: {
        type: 'string',
        enum: ['personal', 'preference', 'project', 'skill', 'habit', 'other'],
        description: 'Category of the fact',
      },
      name: { type: 'string', description: 'User name (for set_name action)' },
      key: { type: 'string', description: 'Preference key (for set_preference action, e.g. "language", "theme")' },
      value: { type: 'string', description: 'Preference value (for set_preference action)' },
    },
    required: ['action'],
  };

  private profileManager: UserProfileManager;

  constructor(profileManager: UserProfileManager) {
    this.profileManager = profileManager;
  }

  async execute(args: { action: string; fact?: string; category?: string; name?: string; key?: string; value?: string }): Promise<string> {
    switch (args.action) {
      case 'add_fact':
        if (!args.fact) return 'Error: fact is required for add_fact';
        this.profileManager.learnFact(args.fact, (args.category as any) || 'other');
        return `Learned: ${args.fact}`;
      case 'set_name':
        if (!args.name) return 'Error: name is required for set_name';
        this.profileManager.setName(args.name);
        return `Saved name: ${args.name}`;
      case 'set_preference':
        if (!args.key || !args.value) return 'Error: key and value are required for set_preference';
        this.profileManager.setPreference(args.key, args.value);
        return `Saved preference: ${args.key} = ${args.value}`;
      default:
        return `Unknown action: ${args.action}`;
    }
  }
}
