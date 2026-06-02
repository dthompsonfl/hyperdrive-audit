import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('fixtures', import.meta.url).pathname);
const cli = resolve(new URL('../bin/hyperdrive-auditor.mjs', import.meta.url).pathname);
function run(args, opts = {}) { return execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }); }
function json(args) { return JSON.parse(run([...args, '--format', 'json', '--no-fail'])); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function hasRule(payload, rule) { return payload.findings.some((finding) => finding.rule === rule); }

assert(run(['--list-rules']).includes('client-graph-imports-server-code'), '--list-rules missing core rule');
assert(run(['--explain-rule', 'client-graph-imports-server-code']).includes('client-graph-imports-server-code'), '--explain-rule failed');
assert(run([]).includes('Start guided mode'), 'no-arg non-interactive help failed');
assert(run(['guide']).includes('guided mode requires an interactive terminal'), 'guide non-interactive fallback failed');

const clean = json(['--root', join(root, 'next-clean-app')]);
assert(Array.isArray(clean.recommendations), 'JSON output missing recommendations array');
assert(!clean.findings.some((f) => f.severity === 'critical'), 'clean fixture has critical findings');

const clientServer = json(['--root', join(root, 'next-client-imports-server')]);
assert(hasRule(clientServer, 'client-graph-imports-server-code') || hasRule(clientServer, 'client-entry-reaches-server-only-code'), 'client/server contamination not detected');

const edge = json(['--root', join(root, 'next-edge-imports-prisma')]);
assert(hasRule(edge, 'edge-route-reaches-node-only-code') || hasRule(edge, 'edge-runtime-imports-node-only-code') || hasRule(edge, 'edge-runtime-transitively-imports-node-code'), 'edge/prisma contamination not detected');

const action = json(['--root', join(root, 'next-server-action-unsafe')]);
assert(hasRule(action, 'server-action-missing-validation') || hasRule(action, 'server-action-no-validation') || hasRule(action, 'server-action-nonserializable-signature'), 'unsafe server action not detected');

const env = json(['--root', join(root, 'env-missing-example')]);
assert(hasRule(env, 'env-used-but-missing-example'), 'missing env example not detected');

const docker = json(['--root', join(root, 'docker-risky')]);
assert(hasRule(docker, 'docker-runs-as-root'), 'docker root risk not detected');

const sarifPath = '/tmp/hyperdrive-fixture.sarif';
run(['--root', join(root, 'sarif-smoke'), '--sarif-output', sarifPath, '--no-fail']);
const sarif = JSON.parse(readFileSync(sarifPath, 'utf8'));
assert(sarif.version === '2.1.0', 'SARIF version mismatch');

const fixPath = '/tmp/hyperdrive-fixture-fixes.json';
run(['--root', join(root, 'env-missing-example'), '--fix-dry-run', '--fix-report-output', fixPath, '--no-fail']);
assert(existsSync(fixPath), 'fix dry-run output missing');
JSON.parse(readFileSync(fixPath, 'utf8'));


const hotspotsPath = '/tmp/hyperdrive-fixture-hotspots.json';
const actionPlanPath = '/tmp/hyperdrive-fixture-action-plan.json';
run(['--root', join(root, 'next-client-imports-server'), '--critical-only', '--summary-only', '--fast', '--hotspots-output', hotspotsPath, '--action-plan-output', actionPlanPath, '--no-fail']);
const hotspots = JSON.parse(readFileSync(hotspotsPath, 'utf8'));
const actionPlan = JSON.parse(readFileSync(actionPlanPath, 'utf8'));
assert(hotspots.criticalInsights?.totalCritical >= 1, 'hotspots output missing critical insights');
assert(Array.isArray(actionPlan.workstreams), 'action plan output missing workstreams');

const baselinePath = '/tmp/hyperdrive-fixture-baseline.json';
run(['--root', join(root, 'next-client-imports-server'), '--write-baseline', baselinePath, '--no-fail']);
assert(existsSync(baselinePath), 'baseline output missing');
const baselineCompare = json(['--root', join(root, 'next-client-imports-server'), '--baseline', baselinePath, '--new-only']);
assert(baselineCompare.baseline?.enabled, 'baseline comparison missing from JSON');
assert(baselineCompare.baseline.newCount === 0, 'baseline comparison should have zero new findings');

console.log('Fixture tests passed');
