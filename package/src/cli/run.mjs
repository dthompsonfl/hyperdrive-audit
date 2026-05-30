import { isAbsolute, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { HyperdriveAuditor, VERSION, parseArgs, printHelp, renderPretty, renderMarkdown, renderJson, shouldFail } from '../audit/Auditor.mjs';
import { loadHyperdriveConfig } from '../config/load-config.mjs';
import { RULES, explainRule } from '../rules/index.mjs';
import { runInit } from '../init/run-init.mjs';
import { runDoctor } from '../doctor/run-doctor.mjs';

function outputRuleList() {
  return `${RULES.map((rule) => `${rule.id}\t${rule.defaultSeverity}\t${rule.category}\t${rule.title}`).join('\n')}\n`;
}

function outputRuleExplanation(id) {
  const rule = explainRule(id);
  if (!rule) return `Rule not found: ${id}\n`;
  return `${rule.id}\n${'-'.repeat(rule.id.length)}\nCategory: ${rule.category}\nDefault severity: ${rule.defaultSeverity}\nTitle: ${rule.title}\n\n${rule.description}\n\nWhy it matters:\n${rule.whyItMatters}\n\nHow to fix:\n${rule.howToFix.map((step) => `- ${step}`).join('\n')}\n${rule.docsUrl ? `\nDocs: ${rule.docsUrl}\n` : ''}`;
}

function printGlobalHelp() {
  console.log(`Hyperdrive Auditor v${VERSION}\n\nUsage:\n  hyperdrive-auditor [audit] [options]\n  hyperdrive-auditor init [options]\n  hyperdrive-auditor doctor [options]\n  hyperdrive-auditor fix [options]\n\nCommands:\n  audit     Run the auditor. This is the default command.\n  init      Install Hyperdrive config, scripts, CI, and artifact ignores into a repo.\n  doctor    Verify Hyperdrive is correctly installed in a repo.\n  fix       Apply safe fixes. Equivalent to audit --fix.\n\nRun \`hyperdrive-auditor audit --help\`, \`hyperdrive-auditor init --help\`, or \`hyperdrive-auditor doctor --help\` for command options.\n`);
}

async function runAudit(rawArgv) {
  const rawOptions = parseArgs(rawArgv);
  if (rawOptions.version) {
    console.log(VERSION);
    return { exitCode: 0 };
  }
  if (rawOptions.help) {
    printHelp();
    return { exitCode: 0 };
  }
  if (rawOptions.listRules) {
    process.stdout.write(outputRuleList());
    return { exitCode: 0 };
  }
  if (rawOptions.explainRule) {
    process.stdout.write(outputRuleExplanation(rawOptions.explainRule));
    return { exitCode: explainRule(rawOptions.explainRule) ? 0 : 1 };
  }

  const options = loadHyperdriveConfig(rawOptions);
  const auditor = new HyperdriveAuditor(options);
  const findings = auditor.run();
  const artifacts = [options.graphOutput, options.typeReportOutput, options.fixSuggestionsOutput, options.sarifOutput, options.budgetOutput, options.codemodOutput, options.fixReportOutput].filter(Boolean);
  const failureReason = shouldFail(findings, options.failOn) ? `Findings met or exceeded --fail-on ${options.failOn}.` : null;
  const meta = { artifacts, rules: RULES, config: { profile: options.profile, failOn: options.failOn, minSeverity: options.minSeverity, ignoreRules: options.ignoreRules, budgets: options.budgets }, failureReason };

  let output;
  if (options.format === 'json') output = renderJson(findings, auditor.root, meta);
  else if (options.format === 'markdown') output = renderMarkdown(findings, auditor.root, meta);
  else output = renderPretty(findings, auditor.root);

  if (options.output) {
    const outputPath = isAbsolute(options.output) ? options.output : join(auditor.root, options.output);
    writeFileSync(outputPath, output, 'utf8');
    console.log(`Hyperdrive audit report written to ${outputPath}`);
  } else {
    process.stdout.write(output);
  }

  return { exitCode: shouldFail(findings, options.failOn) ? 1 : 0, findings };
}

export async function runCli(argv) {
  const [maybeCommand, ...rest] = argv;
  if (!maybeCommand || maybeCommand.startsWith('-')) {
    if (maybeCommand === '--help' || maybeCommand === '-h') {
      printGlobalHelp();
      return { exitCode: 0 };
    }
    return runAudit(argv);
  }
  switch (maybeCommand) {
    case 'audit':
      return runAudit(rest);
    case 'fix':
      return runAudit(['--fix', ...rest]);
    case 'init':
      return runInit(rest);
    case 'doctor':
      return runDoctor(rest);
    case 'help':
      printGlobalHelp();
      return { exitCode: 0 };
    default:
      throw new Error(`Unknown command: ${maybeCommand}`);
  }
}
