import { FEATURE_FLAGS } from './config';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, message: string, ...args: unknown[]) {
  if (level === 'debug' && !FEATURE_FLAGS.debugLogging) {
    return;
  }
  const prefix = `[BMR Slicer]`;
  // eslint-disable-next-line no-console
  console[level](prefix, message, ...args);
}

export const logger = {
  info: (message: string, ...args: unknown[]) => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', message, ...args),
  debug: (message: string, ...args: unknown[]) => log('debug', message, ...args)
};
