import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const HYPERDRIVE_GITIGNORE_PATTERNS = [
  'hyperdrive-report.md',
  'hyperdrive-graph.json',
  'hyperdrive-type-report.json',
  'hyperdrive-fixes.json',
  'hyperdrive-budget.json',
  'hyperdrive-fix-report.json',
  'hyperdrive.sarif',
  '.hyperdrive-codemod-backups/'
];

export function writeGitignore(root, { dryRun = false } = {}) {
  const path = join(root, '.gitignore');
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const lines = new Set(current.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const missing = HYPERDRIVE_GITIGNORE_PATTERNS.filter((pattern) => !lines.has(pattern));
  if (missing.length && !dryRun) {
    const prefix = current.trimEnd() ? `${current.trimEnd()}\n\n` : '';
    writeFileSync(path, `${prefix}# Hyperdrive Auditor artifacts\n${missing.join('\n')}\n`, 'utf8');
  }
  return { path, changed: missing.length > 0, missing };
}
