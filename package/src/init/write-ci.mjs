import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function workflowContent(packageManager = 'npm') {
  const setup = packageManager === 'bun'
    ? '- uses: oven-sh/setup-bun@v2\n      - run: bun install --frozen-lockfile'
    : packageManager === 'pnpm'
      ? '- uses: pnpm/action-setup@v4\n        with:\n          version: 9\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: pnpm\n      - run: pnpm install --frozen-lockfile'
      : '- uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - run: npm ci';
  const runPrefix = packageManager === 'bun' ? 'bun run' : packageManager === 'pnpm' ? 'pnpm' : 'npm run';
  return `name: Hyperdrive Auditor\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n  audit:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      security-events: write\n    steps:\n      - uses: actions/checkout@v4\n      ${setup}\n      - run: ${runPrefix} audit:performance:ci\n      - run: ${runPrefix} audit:performance:sarif\n      - uses: github/codeql-action/upload-sarif@v3\n        if: always()\n        with:\n          sarif_file: hyperdrive.sarif\n`;
}

export function writeGitHubWorkflow(root, { dryRun = false, force = false, packageManager = 'npm' } = {}) {
  const dir = join(root, '.github', 'workflows');
  const path = join(dir, 'hyperdrive-auditor.yml');
  if (existsSync(path) && !force) return { path, changed: false, skipped: true };
  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, workflowContent(packageManager), 'utf8');
  }
  return { path, changed: true, skipped: false };
}
