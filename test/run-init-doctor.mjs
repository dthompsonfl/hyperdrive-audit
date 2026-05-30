import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = mkdtempSync(join(tmpdir(), 'hyperdrive-init-'));
try {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture-app', private: true, packageManager: 'npm@10.0.0', scripts: {} }, null, 2));
  const cli = join(process.cwd(), 'bin', 'hyperdrive-auditor.mjs');
  execFileSync('node', [cli, 'init', '--root', root, '--dry-run', '--format', 'json'], { stdio: 'pipe' });
  execFileSync('node', [cli, 'init', '--root', root, '--format', 'json'], { stdio: 'pipe' });
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!pkg.devDependencies?.['@vantus/hyperdrive-auditor']) throw new Error('init did not add devDependency');
  if (!pkg.scripts?.['audit:performance:ci']) throw new Error('init did not add audit:performance:ci');
  if (!existsSync(join(root, 'hyperdrive.config.json'))) throw new Error('init did not write config');
  if (!existsSync(join(root, '.github', 'workflows', 'hyperdrive-auditor.yml'))) throw new Error('init did not write workflow');
  const doctor = execFileSync('node', [cli, 'doctor', '--root', root, '--format', 'json'], { encoding: 'utf8' });
  const result = JSON.parse(doctor);
  if (!result.passed) throw new Error(`doctor failed: ${doctor}`);
  console.log('init/doctor fixtures passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
