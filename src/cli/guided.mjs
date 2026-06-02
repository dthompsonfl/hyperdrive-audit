import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { runAuditCommand } from './run-audit.mjs';
import { runInit } from '../init/run-init.mjs';
import { runDoctor } from '../doctor/run-doctor.mjs';
import { explainRule, RULES } from '../rules/index.mjs';

export function isInteractiveTerminal() {
  return Boolean(input.isTTY && output.isTTY);
}

function createPrompt() {
  return createInterface({ input, output });
}

async function ask(rl, question, fallback = '') {
  const suffix = fallback ? ` (${fallback})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || fallback;
}

async function choose(rl, question, choices, fallbackIndex = 0) {
  console.log(`\n${question}`);
  choices.forEach((choice, index) => console.log(`  ${index + 1}. ${choice.label}`));
  const fallback = String(fallbackIndex + 1);
  const raw = await ask(rl, 'Choose an option', fallback);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > choices.length) return choices[fallbackIndex];
  return choices[parsed - 1];
}

function splitCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export async function runGuidedMode(argv = []) {
  if (!isInteractiveTerminal()) {
    console.log('Hyperdrive Auditor guided mode requires an interactive terminal.');
    console.log('Try one of these commands instead:');
    console.log('  hyperdrive-auditor audit --root . --profile balanced');
    console.log('  hyperdrive-auditor init --root . --ci github --sarif --budgets');
    console.log('  hyperdrive-auditor doctor --root .');
    return { exitCode: 0 };
  }

  const rl = createPrompt();
  try {
    console.log('Hyperdrive Auditor guided setup');
    console.log('This wizard helps you choose the correct command and arguments.');

    const action = await choose(rl, 'What do you want to do?', [
      { id: 'audit', label: 'Run an audit now' },
      { id: 'init', label: 'Install Hyperdrive into this repo' },
      { id: 'doctor', label: 'Verify Hyperdrive installation' },
      { id: 'fix', label: 'Plan safe fixes / codemods' },
      { id: 'explain', label: 'Explain an audit rule' },
      { id: 'recommend', label: 'Show recommended enterprise workflow' },
    ]);

    if (action.id === 'recommend') {
      console.log('\nRecommended enterprise workflow:');
      console.log('  1. hyperdrive-auditor init --root . --ci github --sarif --budgets --yes');
      console.log('  2. hyperdrive-auditor doctor --root .');
      console.log('  3. hyperdrive-auditor audit --root . --profile ci --fail-on high --sarif-output hyperdrive.sarif --budget-output hyperdrive-budget.json --budget-fail');
      console.log('  4. hyperdrive-auditor fix --root . --fix-dry-run --fix-report-output hyperdrive-fix-report.json --no-fail');
      return { exitCode: 0 };
    }

    if (action.id === 'explain') {
      const query = await ask(rl, 'Rule id to explain', RULES[0]?.id || 'client-graph-imports-server-code');
      const rule = explainRule(query);
      if (!rule) {
        console.log(`Rule not found: ${query}`);
        return { exitCode: 1 };
      }
      console.log(`\n${rule.id}\n${'-'.repeat(rule.id.length)}`);
      console.log(`Category: ${rule.category}`);
      console.log(`Default severity: ${rule.defaultSeverity}`);
      console.log(`\n${rule.description}`);
      console.log(`\nWhy it matters:\n${rule.whyItMatters}`);
      console.log('\nHow to fix:');
      for (const step of rule.howToFix || []) console.log(`- ${step}`);
      if (rule.docsUrl) console.log(`\nDocs: ${rule.docsUrl}`);
      return { exitCode: 0 };
    }

    const root = await ask(rl, 'Repository root', process.cwd());

    if (action.id === 'init') {
      const pm = await ask(rl, 'Package manager: auto, bun, pnpm, yarn, npm', 'auto');
      const ci = await ask(rl, 'CI provider: github or none', 'github');
      const sarif = await ask(rl, 'Enable SARIF scripts? yes/no', 'yes');
      const budgets = await ask(rl, 'Enable budget scripts? yes/no', 'yes');
      const apply = await ask(rl, 'Write files now? yes/no', 'yes');
      const initArgs = ['--root', root, '--package-manager', pm, '--ci', ci];
      initArgs.push(sarif.toLowerCase().startsWith('n') ? '--no-sarif' : '--sarif');
      initArgs.push(budgets.toLowerCase().startsWith('n') ? '--no-budgets' : '--budgets');
      if (apply.toLowerCase().startsWith('y')) initArgs.push('--yes');
      else initArgs.push('--dry-run');
      return runInit(initArgs);
    }

    if (action.id === 'doctor') {
      return runDoctor(['--root', root]);
    }

    if (action.id === 'fix') {
      const rules = await ask(rl, 'Limit to fix rules? comma-separated or blank for all safe fixes', '');
      const apply = await ask(rl, 'Apply fixes now? yes/no', 'no');
      const fixArgs = ['--root', root, apply.toLowerCase().startsWith('y') ? '--fix' : '--fix-dry-run', '--fix-report-output', 'hyperdrive-fix-report.json', '--no-fail'];
      for (const rule of splitCsv(rules)) fixArgs.push('--fix-rule', rule);
      return runAuditCommand(fixArgs);
    }

    const profile = await ask(rl, 'Profile: balanced, strict, ci', 'balanced');
    const failOn = await ask(rl, 'Fail on severity: never, info, low, medium, high, critical', profile === 'ci' ? 'high' : 'never');
    const artifacts = await ask(rl, 'Generate artifacts? none, standard, all', 'standard');
    const auditArgs = ['--root', root, '--profile', profile, '--fail-on', failOn];
    if (artifacts === 'standard' || artifacts === 'all') {
      auditArgs.push('--format', 'markdown', '--output', 'hyperdrive-report.md', '--sarif-output', 'hyperdrive.sarif', '--budget-output', 'hyperdrive-budget.json');
    }
    if (artifacts === 'all') {
      auditArgs.push('--graph-output', 'hyperdrive-graph.json', '--type-report-output', 'hyperdrive-type-report.json', '--fix-suggestions-output', 'hyperdrive-fixes.json');
    }
    return runAuditCommand(auditArgs);
  } finally {
    rl.close();
  }
}
