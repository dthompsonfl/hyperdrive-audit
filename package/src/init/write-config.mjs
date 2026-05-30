import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_HYPERDRIVE_CONFIG = {
  profile: 'balanced',
  failOn: 'high',
  minSeverity: 'info',
  include: [],
  exclude: [],
  ignoreRules: [],
  ignoreFiles: [],
  rules: {},
  budgets: {
    clientMaxModules: 120,
    clientMaxLines: 12000,
    clientMaxHeavyImports: 0,
    maxServerReachableFromClient: 0,
    maxCycles: 0
  },
  packageManager: 'auto',
  frameworks: {
    next: true,
    prisma: true,
    tailwind: true,
    turborepo: true
  },
  sarif: {
    includeAutofixHelp: true
  }
};

export function writeConfig(root, { dryRun = false, force = false } = {}) {
  const path = join(root, 'hyperdrive.config.json');
  if (existsSync(path) && !force) return { path, changed: false, skipped: true };
  if (!dryRun) writeFileSync(path, `${JSON.stringify(DEFAULT_HYPERDRIVE_CONFIG, null, 2)}\n`, 'utf8');
  return { path, changed: true, skipped: false };
}
