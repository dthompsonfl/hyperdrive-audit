import { isAbsolute, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { HyperdriveAuditor, parseArgs, printHelp, renderPretty, renderMarkdown, renderJson, shouldFail } from '../audit/Auditor.mjs';
import { loadHyperdriveConfig } from '../config/load-config.mjs';
import { RULES, explainRule } from '../rules/index.mjs';
import { buildRecommendations, renderRecommendations } from './recommendations.mjs';

export function outputRuleList() {
  return `${RULES.map((rule) => `${rule.id}\t${rule.defaultSeverity}\t${rule.category}\t${rule.title}`).join('\n')}\n`;
}

export function outputRuleExplanation(id) {
  const rule = explainRule(id);
  if (!rule) return `Rule not found: ${id}\n`;
  return `${rule.id}\n${'-'.repeat(rule.id.length)}\nCategory: ${rule.category}\nDefault severity: ${rule.defaultSeverity}\nTitle: ${rule.title}\n\n${rule.description}\n\nWhy it matters:\n${rule.whyItMatters}\n\nHow to fix:\n${rule.howToFix.map((step) => `- ${step}`).join('\n')}\n${rule.docsUrl ? `\nDocs: ${rule.docsUrl}\n` : ''}`;
}

export async function runAuditCommand(rawArgv) {
  const rawOptions = parseArgs(rawArgv);
  if (rawOptions.version) {
    const { VERSION } = await import('../audit/Auditor.mjs');
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
  const recommendations = buildRecommendations(findings, options);
  const failureReason = shouldFail(findings, options.failOn) ? `Findings met or exceeded --fail-on ${options.failOn}.` : null;
  const meta = {
    artifacts,
    recommendations,
    rules: RULES,
    config: { profile: options.profile, failOn: options.failOn, minSeverity: options.minSeverity, ignoreRules: options.ignoreRules, budgets: options.budgets },
    failureReason
  };

  let output;
  if (options.format === 'json') output = renderJson(findings, auditor.root, meta);
  else if (options.format === 'markdown') output = renderMarkdown(findings, auditor.root, meta);
  else output = `${renderPretty(findings, auditor.root)}${findings.length ? `\n${renderRecommendations(recommendations)}` : ''}`;

  if (options.output) {
    const outputPath = isAbsolute(options.output) ? options.output : join(auditor.root, options.output);
    writeFileSync(outputPath, output, 'utf8');
    console.log(`Hyperdrive audit report written to ${outputPath}`);
    if (findings.length && options.format !== 'json') process.stdout.write(renderRecommendations(recommendations));
  } else {
    process.stdout.write(output);
  }

  return { exitCode: shouldFail(findings, options.failOn) ? 1 : 0, findings, recommendations };
}
