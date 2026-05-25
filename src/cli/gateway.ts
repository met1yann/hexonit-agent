import { Logger } from '../utils/logger.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PID_FILE = path.join(os.homedir(), '.hexonit', 'gateway.pid');
const LOG_FILE = path.join(os.homedir(), '.hexonit', 'gateway.log');

export async function runGatewayCommand(command: string): Promise<void> {
  switch (command) {
    case 'start':
      return startGateway();
    case 'stop':
    case 'disable':
      return stopGateway();
    case 'status':
      return checkStatus();
    case 'restart':
      await stopGateway();
      return startGateway();
    default:
      Logger.error(`Unknown command: ${command}. Use start, stop, restart, or status.`);
  }
}

function startGateway(): void {
  if (fs.existsSync(PID_FILE)) {
    Logger.warning('Gateway is already running.');
    return;
  }
  const child = spawn(process.execPath, [process.argv[1], 'chat'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, HEXONIT_GATEWAY: '1' },
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid), 'utf-8');
  fs.writeFileSync(LOG_FILE, `Gateway started at ${new Date().toISOString()}\n`, 'utf-8');
  Logger.success(`Gateway started (PID: ${child.pid}).`);
  Logger.info('Running in background. Use "hexonit gateway stop" to terminate.');
}

function stopGateway(): void {
  if (!fs.existsSync(PID_FILE)) {
    Logger.warning('Gateway is not running.');
    return;
  }
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // process already dead
    }
    fs.unlinkSync(PID_FILE);
    fs.appendFileSync(LOG_FILE, `Gateway stopped at ${new Date().toISOString()}\n`);
    Logger.success(`Gateway stopped (PID: ${pid}).`);
  } catch (error: any) {
    Logger.error('Failed to stop gateway', error);
  }
}

function checkStatus(): void {
  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
    try {
      process.kill(parseInt(pid, 10), 0);
      Logger.info(`Gateway is ONLINE (PID: ${pid}).`);
    } catch {
      Logger.warning(`PID ${pid} exists but process is not running. Stale PID file.`);
      Logger.info('Run "hexonit gateway stop" to clean up, then "start".');
    }
  } else {
    Logger.info('Gateway is OFFLINE.');
  }
}
