import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function readPackageJson(root) {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writePackageJson(root, pkg) {
  const path = join(root, 'package.json');
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

export function mergePackageJson(root, patch, { dryRun = false } = {}) {
  const pkg = readPackageJson(root);
  if (!pkg) throw new Error(`No package.json found at ${join(root, 'package.json')}`);
  const next = structuredClone(pkg);
  if (patch.devDependencyName) {
    next.devDependencies ||= {};
    if (!next.devDependencies[patch.devDependencyName] && !next.dependencies?.[patch.devDependencyName]) {
      next.devDependencies[patch.devDependencyName] = patch.devDependencyVersion;
    }
  }
  if (patch.scripts) {
    next.scripts ||= {};
    for (const [name, command] of Object.entries(patch.scripts)) {
      if (!next.scripts[name]) next.scripts[name] = command;
    }
  }
  const changed = JSON.stringify(pkg) !== JSON.stringify(next);
  if (changed && !dryRun) writePackageJson(root, next);
  return { changed, before: pkg, after: next };
}
