export const DEFAULT_CONFIG = Object.freeze({
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
    maxCycles: 0,
  },
  packageManager: 'auto',
  frameworks: { next: true, prisma: true, tailwind: true, turborepo: true },
  sarif: { includeAutofixHelp: true },
});

export const CONFIG_FILE_NAMES = [
  'hyperdrive.config.json',
  'hyperdrive.config.jsonc',
  '.hyperdriverc',
  '.hyperdriverc.json',
  '.hyperdrive-auditor.json',
];
