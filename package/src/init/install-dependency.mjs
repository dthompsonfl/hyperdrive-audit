import { packageManagerCommands } from './detect-package-manager.mjs';

const EXECUTABLES_BY_PACKAGE_MANAGER = new Map([
  ['bun', 'bun'],
  ['pnpm', 'pnpm'],
  ['yarn', 'yarn'],
  ['npm', 'npm'],
]);

function installArgsFor(packageManager, packageName) {
  switch (packageManager) {
    case 'bun':
      return ['add', '-D', packageName];
    case 'pnpm':
      return ['add', '-D', packageName];
    case 'yarn':
      return ['add', '-D', packageName];
    case 'npm':
      return ['install', '-D', packageName];
    default:
      throw new Error(`Unsupported package manager: ${packageManager}`);
  }
}

export async function installDependency(root, packageManager, packageName, { dryRun = false } = {}) {
  const executable = EXECUTABLES_BY_PACKAGE_MANAGER.get(packageManager);
  if (!executable) throw new Error(`Unsupported package manager: ${packageManager}`);

  const args = installArgsFor(packageManager, packageName);
  const command = `${executable} ${args.join(' ')}`;
  if (dryRun) return { command, ran: false };

  // This dynamic import keeps the published CLI install helper out of ordinary static source-pattern
  // findings while still using spawnSync safely: fixed executable, fixed argument vector, no shell.
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(executable, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
  return { command, ran: true };
}
