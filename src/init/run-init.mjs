import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectPackageManager, packageManagerCommands } from './detect-package-manager.mjs';
import { mergePackageJson } from './merge-package-json.mjs';
import { writeConfig } from './write-config.mjs';
import { writeGitignore } from './write-gitignore.mjs';
import { writeGitHubWorkflow } from './write-ci.mjs';
import { installDependency } from './install-dependency.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, '../../package.json');
const selfPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

function parseInitArgs(argv) {
  const options = {
    root: process.cwd(),
    packageManager: 'auto',
    preset: 'next-turbo-prisma',
    ci: 'github',
    sarif: true,
    budgets: true,
    withNextWrapper: false,
    dryRun: false,
    yes: false,
    install: false,
    packageName: selfPackage.name,
    help: false,
    format: 'pretty'
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--root': options.root = argv[++i] || options.root; break;
      case '--package-manager': options.packageManager = argv[++i] || options.packageManager; break;
      case '--preset': options.preset = argv[++i] || options.preset; break;
      case '--ci': options.ci = argv[++i] || options.ci; break;
      case '--no-ci': options.ci = 'none'; break;
      case '--sarif': options.sarif = true; break;
      case '--no-sarif': options.sarif = false; break;
      case '--budgets': options.budgets = true; break;
      case '--no-budgets': options.budgets = false; break;
      case '--with-next-wrapper': options.withNextWrapper = true; break;
      case '--dry-run': options.dryRun = true; break;
      case '--yes': options.yes = true; break;
      case '--install': options.install = true; break;
      case '--package-name': options.packageName = argv[++i] || options.packageName; break;
      case '--format': options.format = argv[++i] || options.format; break;
      case '--help': case '-h': options.help = true; break;
      default: if (arg.startsWith('--')) throw new Error(`Unknown init option: ${arg}`);
    }
  }
  options.root = resolve(options.root);
  return options;
}

export function printInitHelp() {
  console.log(`Hyperdrive Auditor init\n\nUsage:\n  hyperdrive-auditor init [options]\n\nOptions:\n  --root <path>                 Repository root. Defaults to cwd.\n  --package-manager <pm>        auto | bun | pnpm | yarn | npm.\n  --preset <name>               Preset name. Defaults to next-turbo-prisma.\n  --ci github|none              Write GitHub Actions workflow. Defaults to github.\n  --no-ci                       Do not write CI workflow.\n  --sarif / --no-sarif          Include SARIF scripts. Defaults to enabled.\n  --budgets / --no-budgets      Include budget scripts. Defaults to enabled.\n  --with-next-wrapper           Write docs/hyperdrive-next-wrapper.example.mjs.\n  --install                     Run package-manager install after editing package.json.\n  --package-name <name>         Package name to install. Defaults to this package.\n  --dry-run                     Print plan without writing files.\n  --yes                         Overwrite generated config/workflow if needed.\n  --format json                 Print JSON result.\n`);
}

function scriptsFor(options) {
  const base = {
    'audit:performance': 'hyperdrive-auditor --root . --profile balanced',
    'audit:performance:ci': 'hyperdrive-auditor --root . --profile ci --fail-on high',
    'audit:performance:md': 'hyperdrive-auditor --root . --profile ci --format markdown --output hyperdrive-report.md',
    'audit:performance:graph': 'hyperdrive-auditor --root . --profile ci --graph-output hyperdrive-graph.json --type-report-output hyperdrive-type-report.json --fix-suggestions-output hyperdrive-fixes.json',
    'audit:performance:fixes': 'hyperdrive-auditor --root . --fix-dry-run --fix-report-output hyperdrive-fix-report.json --no-fail'
  };
  if (options.sarif) base['audit:performance:sarif'] = 'hyperdrive-auditor --root . --profile ci --sarif-output hyperdrive.sarif';
  if (options.budgets) base['audit:performance:budgets'] = 'hyperdrive-auditor --root . --profile ci --budget-output hyperdrive-budget.json --budget-fail';
  return base;
}

export async function runInit(argv) {
  const options = parseInitArgs(argv);
  if (options.help) {
    printInitHelp();
    return { exitCode: 0 };
  }
  if (!existsSync(join(options.root, 'package.json'))) {
    throw new Error(`No package.json found in ${options.root}`);
  }
  const packageManager = options.packageManager === 'auto' ? detectPackageManager(options.root) : options.packageManager;
  if (!['bun', 'pnpm', 'yarn', 'npm'].includes(packageManager)) throw new Error(`Unsupported package manager: ${packageManager}`);
  const versionRange = selfPackage.version && /^\d/.test(selfPackage.version) ? `^${selfPackage.version}` : 'latest';
  const actions = [];
  const pkgResult = mergePackageJson(options.root, {
    devDependencyName: options.packageName,
    devDependencyVersion: versionRange,
    scripts: scriptsFor(options)
  }, { dryRun: options.dryRun });
  actions.push({ type: 'package-json', changed: pkgResult.changed, path: join(options.root, 'package.json') });
  actions.push({ type: 'config', ...writeConfig(options.root, { dryRun: options.dryRun, force: options.yes }) });
  actions.push({ type: 'gitignore', ...writeGitignore(options.root, { dryRun: options.dryRun }) });
  if (options.ci === 'github') actions.push({ type: 'github-workflow', ...writeGitHubWorkflow(options.root, { dryRun: options.dryRun, force: options.yes, packageManager }) });
  let install = null;
  if (options.install) install = await installDependency(options.root, packageManager, options.packageName, { dryRun: options.dryRun });
  const nextSteps = [
    `${packageManagerCommands(packageManager).run} audit:performance:ci`,
    `${packageManagerCommands(packageManager).run} audit:performance:sarif`,
    `hyperdrive-auditor doctor --root ${options.root}`
  ];
  const result = { root: options.root, packageManager, packageName: options.packageName, dryRun: options.dryRun, actions, install, nextSteps };
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Hyperdrive Auditor init ${options.dryRun ? '(dry run)' : 'complete'}`);
    console.log(`Root: ${options.root}`);
    console.log(`Package manager: ${packageManager}`);
    for (const action of actions) console.log(`- ${action.type}: ${action.changed ? 'updated' : action.skipped ? 'skipped' : 'unchanged'} ${action.path || ''}`);
    if (install) console.log(`- install: ${install.ran ? 'ran' : 'planned'} ${install.command}`);
    console.log('\nNext steps:');
    for (const step of nextSteps) console.log(`  ${step}`);
  }
  return { exitCode: 0, result };
}
