import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { DEFAULT_CONFIG, CONFIG_FILE_NAMES } from './defaults.mjs';
import { validateConfig } from './schema.mjs';

function stripJsonComments(raw) {
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function readConfigFile(path) {
  const raw = readFileSync(path, 'utf8');
  return validateConfig(JSON.parse(stripJsonComments(raw)), path);
}

function findConfig(root) {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = join(root, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function loadHyperdriveConfig(cliOptions) {
  const root = resolve(cliOptions.root || process.cwd());
  const configPath = cliOptions.configPath ? (isAbsolute(cliOptions.configPath) ? cliOptions.configPath : join(root, cliOptions.configPath)) : findConfig(root);
  const fileConfig = configPath && existsSync(configPath) ? readConfigFile(configPath) : {};
  const merged = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    root,
    profile: cliOptions.profile || fileConfig.profile || DEFAULT_CONFIG.profile,
    failOn: cliOptions.failOn || fileConfig.failOn || DEFAULT_CONFIG.failOn,
    minSeverity: cliOptions.minSeverity || fileConfig.minSeverity || DEFAULT_CONFIG.minSeverity,
    include: [...(DEFAULT_CONFIG.include || []), ...(fileConfig.include || []), ...(cliOptions.include || [])],
    exclude: [...(DEFAULT_CONFIG.exclude || []), ...(fileConfig.exclude || []), ...(cliOptions.exclude || [])],
    ignoreRules: [...(DEFAULT_CONFIG.ignoreRules || []), ...(fileConfig.ignoreRules || []), ...(cliOptions.ignoreRules || [])].filter(Boolean),
    ignoreFiles: [...(DEFAULT_CONFIG.ignoreFiles || []), ...(fileConfig.ignoreFiles || [])],
    ruleSeverities: { ...(fileConfig.rules || {}) },
    budgets: { ...DEFAULT_CONFIG.budgets, ...(fileConfig.budgets || {}) },
    frameworks: { ...DEFAULT_CONFIG.frameworks, ...(fileConfig.frameworks || {}) },
    sarif: { ...DEFAULT_CONFIG.sarif, ...(fileConfig.sarif || {}) },
    configPath,
  };
  return { ...cliOptions, ...merged, configPath };
}
