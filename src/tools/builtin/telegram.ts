import { Tool } from '../index.js';
import axios from 'axios';
import { loadConfig } from '../../utils/config.js';

export class TelegramSendTool implements Tool {
  name = 'telegram_send';
  description = 'Sends a text message to a specific Telegram Chat ID using the configured Telegram Bot Token.';
  parameters = {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The Telegram Chat ID (e.g. 123456789) where the message should be sent' },
      message: { type: 'string', description: 'The message body to send' }
    },
    required: ['chat_id', 'message']
  };

  async execute(args: { chat_id: string; message: string }): Promise<string> {
    const config = loadConfig();
    const token = config.keys?.telegram;

    if (!token) {
      return "ERROR: Telegram Bot Token is missing. Tell the user to run 'hexonit setup' and enter a Telegram Bot Token in Phase 4.";
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(url, {
        chat_id: args.chat_id,
        text: args.message
      });
      return `Success: Telegram message sent to chat_id ${args.chat_id}`;
    } catch (error: any) {
      return `ERROR: Failed to send Telegram message. ${error.message}`;
    }
  }
}
