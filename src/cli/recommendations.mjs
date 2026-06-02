const FIXABLE_RULES = new Set([
  'value-import-used-only-as-type',
  'server-module-missing-server-only-marker',
  'browser-module-missing-client-boundary',
  'workspace-import-not-declared',
  'turbo-pipeline-key',
  'root-not-private',
  'env-used-but-missing-example'
]);

function hasRule(findings, rule) {
  return findings.some((finding) => finding.rule === rule || `${finding.category}/${finding.rule}` === rule);
}

function hasCategory(findings, category) {
  return findings.some((finding) => finding.category === category);
}

function highestSeverity(findings) {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  return order.find((severity) => findings.some((finding) => finding.severity === severity)) || null;
}

export function buildRecommendations(findings, options = {}) {
  const recommendations = [];
  const rootArg = '--root .';
  const top = findings[0];
  const topSeverity = highestSeverity(findings);

  if (findings.length === 0) {
    recommendations.push({
      title: 'Keep the audit wired into CI',
      command: 'hyperdrive-auditor doctor --root .',
      reason: 'The current threshold is clean. Verify installation wiring and keep SARIF/budget outputs enabled.'
    });
    return recommendations;
  }

  if (topSeverity === 'critical' || topSeverity === 'high') {
    recommendations.push({
      title: 'Generate a reviewable report for the highest-risk findings',
      command: 'hyperdrive-auditor audit --root . --profile ci --format markdown --output hyperdrive-report.md --no-fail',
      reason: 'Critical/high findings should be triaged in a durable Markdown report before broad refactors.'
    });
  }

  if (top?.rule) {
    recommendations.push({
      title: `Understand the top rule: ${top.rule}`,
      command: `hyperdrive-auditor --explain-rule ${top.rule}`,
      reason: 'Rule explanations include why it matters and safe remediation steps.'
    });
  }

  if (findings.some((finding) => FIXABLE_RULES.has(finding.rule) || finding.autofix)) {
    recommendations.push({
      title: 'Plan safe fixes before editing code',
      command: 'hyperdrive-auditor fix --root . --fix-dry-run --fix-report-output hyperdrive-fix-report.json --no-fail',
      reason: 'The auditor found issues with safe fix metadata. Review the dry-run patch report before applying.'
    });
  }

  if (hasCategory(findings, 'architecture') || hasCategory(findings, 'react') || hasCategory(findings, 'next')) {
    recommendations.push({
      title: 'Export graph artifacts for boundary review',
      command: 'hyperdrive-auditor audit --root . --profile ci --graph-output hyperdrive-graph.json --type-report-output hyperdrive-type-report.json --fix-suggestions-output hyperdrive-fixes.json --no-fail',
      reason: 'Runtime-boundary findings are easier to review with import graph and TypeChecker artifacts.'
    });
  }

  if (hasCategory(findings, 'developer-experience') || hasRule(findings, 'missing-github-actions') || hasRule(findings, 'required-script-missing')) {
    recommendations.push({
      title: 'Verify or install repo wiring',
      command: 'hyperdrive-auditor doctor --root .',
      reason: 'Developer-experience findings often mean config, scripts, CI, or artifact ignores are missing.'
    });
  }

  if (hasCategory(findings, 'security')) {
    recommendations.push({
      title: 'Create SARIF for GitHub code scanning',
      command: 'hyperdrive-auditor audit --root . --profile ci --sarif-output hyperdrive.sarif --no-fail',
      reason: 'Security findings should be surfaced in code scanning where they can be tracked across PRs.'
    });
  }

  if (hasCategory(findings, 'performance') || hasCategory(findings, 'architecture')) {
    recommendations.push({
      title: 'Check runtime/client graph budgets',
      command: 'hyperdrive-auditor audit --root . --profile ci --budget-output hyperdrive-budget.json --budget-fail --no-fail',
      reason: 'Budgets catch client graph growth, heavy imports, server-tainted modules, and cycles.'
    });
  }

  return recommendations.slice(0, 6);
}

export function renderRecommendations(recommendations) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) return '';
  const lines = ['Recommended next steps:'];
  recommendations.forEach((item, index) => {
    lines.push(`  ${index + 1}. ${item.title}`);
    if (item.command) lines.push(`     ${item.command}`);
    if (item.reason) lines.push(`     ${item.reason}`);
  });
  return `${lines.join('\n')}\n`;
}
