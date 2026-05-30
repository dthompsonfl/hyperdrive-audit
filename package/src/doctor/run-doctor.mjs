import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { detectPackageManager } from '../init/detect-package-manager.mjs';

const REQUIRED_SCRIPTS = ['audit:performance', 'audit:performance:ci'];
const OPTIONAL_SCRIPTS = ['audit:performance:sarif', 'audit:performance:budgets', 'audit:performance:fixes'];
const CONFIG_FILES = ['hyperdrive.config.json', 'hyperdrive.config.jsonc', '.hyperdriverc', '.hyperdriverc.json', '.hyperdrive-auditor.json'];
const ARTIFACT_PATTERNS = ['hyperdrive-report.md', 'hyperdrive-graph.json', 'hyperdrive-type-report.json', 'hyperdrive-fixes.json', 'hyperdrive-budget.json', 'hyperdrive-fix-report.json', 'hyperdrive.sarif'];

function parseDoctorArgs(argv) {
  const options = { root: process.cwd(), format: 'pretty', help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--root': options.root = argv[++i] || options.root; break;
      case '--format': options.format = argv[++i] || options.format; break;
      case '--help': case '-h': options.help = true; break;
      default: if (arg.startsWith('--')) throw new Error(`Unknown doctor option: ${arg}`);
    }
  }
  options.root = resolve(options.root);
  return options;
}

export function printDoctorHelp() {
  console.log(`Hyperdrive Auditor doctor\n\nUsage:\n  hyperdrive-auditor doctor [options]\n\nOptions:\n  --root <path>      Repository root. Defaults to cwd.\n  --format json      Print JSON result.\n  -h, --help         Show help.\n`);
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function check(id, title, pass, details = null, severity = 'error') {
  return { id, title, pass: Boolean(pass), severity, details };
}

export async function runDoctor(argv) {
  const options = parseDoctorArgs(argv);
  if (options.help) {
    printDoctorHelp();
    return { exitCode: 0 };
  }
  const root = options.root;
  const packageJsonPath = join(root, 'package.json');
  const pkg = existsSync(packageJsonPath) ? readJson(packageJsonPath) : null;
  const packageManager = existsSync(packageJsonPath) ? detectPackageManager(root) : null;
  const configPath = CONFIG_FILES.map((name) => join(root, name)).find((path) => existsSync(path));
  const gitignorePath = join(root, '.gitignore');
  const gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  const workflowPath = join(root, '.github', 'workflows', 'hyperdrive-auditor.yml');
  const installed = Boolean(pkg?.devDependencies?.['@vantus/hyperdrive-auditor'] || pkg?.dependencies?.['@vantus/hyperdrive-auditor'] || pkg?.devDependencies?.['@your-org/hyperdrive-auditor']);
  const checks = [
    check('package-json-present', 'Root package.json exists', Boolean(pkg), packageJsonPath),
    check('package-manager-detected', 'Package manager can be detected', Boolean(packageManager), packageManager),
    check('auditor-dependency-present', 'Hyperdrive Auditor is declared as a dependency', installed, 'Expected @vantus/hyperdrive-auditor in devDependencies', 'warning'),
    check('config-present', 'Hyperdrive config exists', Boolean(configPath), configPath || CONFIG_FILES.join(', ')),
    ...REQUIRED_SCRIPTS.map((script) => check(`script-${script}`, `Script ${script} exists`, Boolean(pkg?.scripts?.[script]), pkg?.scripts?.[script] || null)),
    ...OPTIONAL_SCRIPTS.map((script) => check(`optional-script-${script}`, `Optional script ${script} exists`, Boolean(pkg?.scripts?.[script]), pkg?.scripts?.[script] || null, 'warning')),
    check('gitignore-artifacts', 'Generated artifacts are ignored', ARTIFACT_PATTERNS.every((pattern) => gitignore.includes(pattern)), ARTIFACT_PATTERNS.filter((pattern) => !gitignore.includes(pattern)), 'warning'),
    check('github-workflow-present', 'GitHub Actions workflow is installed', existsSync(workflowPath), workflowPath, 'warning')
  ];
  const failed = checks.filter((item) => !item.pass && item.severity === 'error');
  const warnings = checks.filter((item) => !item.pass && item.severity === 'warning');
  const result = { root, packageManager, passed: failed.length === 0, failed: failed.length, warnings: warnings.length, checks };
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Hyperdrive Auditor doctor: ${result.passed ? 'passed' : 'failed'}`);
    for (const item of checks) {
      const symbol = item.pass ? '✓' : item.severity === 'warning' ? '!' : '✗';
      console.log(`${symbol} ${item.title}${item.details ? ` — ${Array.isArray(item.details) ? item.details.join(', ') : item.details}` : ''}`);
    }
  }
  return { exitCode: failed.length ? 1 : 0, result };
}
