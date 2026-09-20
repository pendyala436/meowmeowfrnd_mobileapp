/**
 * Dev-only logger utility.
 * In production builds, all log calls become no-ops.
 * Usage: import { log, warn, error } from '@/lib/logger';
 */

export const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

export const warn = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.warn(...args);
};

export const error = (...args: unknown[]) => console.error(...args);
