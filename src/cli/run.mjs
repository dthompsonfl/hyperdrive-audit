import { VERSION } from '../audit/Auditor.mjs';
import { runInit } from '../init/run-init.mjs';
import { runDoctor } from '../doctor/run-doctor.mjs';
import { runGuidedMode, isInteractiveTerminal } from './guided.mjs';
import { runAuditCommand } from './run-audit.mjs';

function printGlobalHelp() {
  console.log(`Hyperdrive Auditor v${VERSION}\n\nUsage:\n  hyperdrive-auditor                 Start guided mode in an interactive terminal.\n  hyperdrive-auditor audit [options] Run the auditor.\n  hyperdrive-auditor init [options]  Install config, scripts, CI, and artifact ignores.\n  hyperdrive-auditor doctor [options]\n                                    Verify Hyperdrive is correctly installed.\n  hyperdrive-auditor fix [options]   Plan/apply safe fixes.\n  hyperdrive-auditor guide           Start the guided command wizard.\n\nCommon workflows:\n  hyperdrive-auditor init --root . --ci github --sarif --budgets --yes\n  hyperdrive-auditor doctor --root .\n  hyperdrive-auditor audit --root . --profile ci --fail-on high\n  hyperdrive-auditor audit --root . --sarif-output hyperdrive.sarif --budget-output hyperdrive-budget.json --budget-fail\n  hyperdrive-auditor fix --root . --fix-dry-run --fix-report-output hyperdrive-fix-report.json --no-fail\n\nCommand help:\n  hyperdrive-auditor audit --help\n  hyperdrive-auditor init --help\n  hyperdrive-auditor doctor --help\n\nRule discovery:\n  hyperdrive-auditor --list-rules\n  hyperdrive-auditor --explain-rule client-graph-imports-server-code\n`);
}

function isGlobalHelpArg(arg) {
  return arg === '--help' || arg === '-h' || arg === 'help';
}

export async function runCli(argv) {
  const [maybeCommand, ...rest] = argv;

  if (!maybeCommand) {
    if (isInteractiveTerminal()) return runGuidedMode([]);
    printGlobalHelp();
    return { exitCode: 0 };
  }

  if (isGlobalHelpArg(maybeCommand)) {
    printGlobalHelp();
    return { exitCode: 0 };
  }

  if (maybeCommand === '--guided' || maybeCommand === 'guide' || maybeCommand === 'guided') {
    return runGuidedMode(rest);
  }

  if (maybeCommand.startsWith('-')) {
    return runAuditCommand(argv);
  }

  switch (maybeCommand) {
    case 'audit':
      return runAuditCommand(rest);
    case 'fix':
      return runAuditCommand(['--fix', ...rest]);
    case 'init':
      return runInit(rest);
    case 'doctor':
      return runDoctor(rest);
    default:
      console.error(`Unknown command: ${maybeCommand}\n`);
      printGlobalHelp();
      return { exitCode: 2 };
  }
}
