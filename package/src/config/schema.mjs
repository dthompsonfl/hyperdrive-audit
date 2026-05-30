const SEVERITIES = new Set(['off', 'info', 'low', 'medium', 'high', 'critical']);
const PROFILES = new Set(['balanced', 'strict', 'ci']);
const PACKAGE_MANAGERS = new Set(['bun', 'pnpm', 'yarn', 'npm', 'auto']);

export function validateConfig(config, source = 'config') {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`${source} must be a JSON object`);
  if (config.profile && !PROFILES.has(config.profile)) throw new Error(`${source}.profile must be balanced, strict, or ci`);
  if (config.failOn && config.failOn !== 'never' && !SEVERITIES.has(config.failOn)) throw new Error(`${source}.failOn must be never or a severity`);
  if (config.minSeverity && !SEVERITIES.has(config.minSeverity)) throw new Error(`${source}.minSeverity must be a severity`);
  if (config.packageManager && !PACKAGE_MANAGERS.has(config.packageManager)) throw new Error(`${source}.packageManager must be bun, pnpm, yarn, npm, or auto`);
  for (const key of ['include', 'exclude', 'ignoreRules', 'ignoreFiles']) if (config[key] && !Array.isArray(config[key])) throw new Error(`${source}.${key} must be an array`);
  if (config.rules) {
    if (typeof config.rules !== 'object' || Array.isArray(config.rules)) throw new Error(`${source}.rules must be an object`);
    for (const [rule, severity] of Object.entries(config.rules)) if (!SEVERITIES.has(severity)) throw new Error(`${source}.rules.${rule} must be off/info/low/medium/high/critical`);
  }
  return config;
}
