import { Tool } from '../index.js';
import * as os from 'os';

export class SystemInfoTool implements Tool {
  name = 'system_info';
  description = 'Retrieves detailed hardware, operating system, and architecture information of the machine Hexonit is currently running on. Useful when debugging environment specific scripts.';
  parameters = {
    type: 'object',
    properties: {}
  };

  async execute(): Promise<string> {
    try {
      const info = {
        osType: os.type(),
        osPlatform: os.platform(),
        osRelease: os.release(),
        architecture: os.arch(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0].model,
        totalMemoryGb: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2),
        freeMemoryGb: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2),
        uptimeHours: (os.uptime() / 3600).toFixed(2),
        homedir: os.homedir(),
        username: os.userInfo().username
      };

      return JSON.stringify(info, null, 2);
    } catch (error: any) {
      return `Failed to fetch system metrics: ${error.message}`;
    }
  }
}
