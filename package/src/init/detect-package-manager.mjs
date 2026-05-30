import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function detectPackageManager(root) {
  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (typeof pkg.packageManager === 'string') {
        const [name] = pkg.packageManager.split('@');
        if (['bun', 'pnpm', 'yarn', 'npm'].includes(name)) return name;
      }
    } catch {}
  }
  if (existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))) return 'bun';
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'package-lock.json'))) return 'npm';
  return 'npm';
}

export function packageManagerCommands(packageManager) {
  switch (packageManager) {
    case 'bun':
      return { addDev: 'bun add -D', run: 'bun run', exec: 'bunx' };
    case 'pnpm':
      return { addDev: 'pnpm add -D', run: 'pnpm', exec: 'pnpm exec' };
    case 'yarn':
      return { addDev: 'yarn add -D', run: 'yarn', exec: 'yarn' };
    default:
      return { addDev: 'npm install -D', run: 'npm run', exec: 'npx' };
  }
}
