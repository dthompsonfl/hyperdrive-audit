# Hyperdrive Auditor

Hyperdrive Auditor is a guided, publish-ready CLI for auditing modern TypeScript monorepos, with a strong focus on Next.js 16+, React 19+, Prisma 7+, Turborepo 2+, runtime-boundary safety, security, dependency hygiene, CI output, graph budgets, SARIF, and guarded safe fixes.

## What it does

- Scans Turbo/Next/React/Prisma TypeScript repositories.
- Builds import graphs and type-aware reports when TypeScript is available.
- Detects client/server graph contamination, unsafe Server Actions, risky route handlers, Prisma and environment mistakes, package drift, Docker/CI issues, and dependency hygiene problems.
- Emits human, JSON, Markdown, SARIF, graph, type-report, budget, recommendation, and safe-fix artifacts.
- Installs itself into host repos with `hyperdrive-auditor init`.
- Verifies installation with `hyperdrive-auditor doctor`.
- Starts an interactive guided command wizard when run without arguments in a terminal.

## What it does not do

- It does not replace `tsc`, ESLint, test suites, dependency scanners, or human architecture review.
- It does not blindly apply risky architectural rewrites. Safe fixes are intentionally narrow.
- It does not require Next.js to be installed; framework-specific checks activate when matching files/packages exist.

## Install

```bash
npm install -D @vantus/hyperdrive-auditor
npx hyperdrive-auditor init --preset next-turbo-prisma --ci github --sarif --budgets
npm run audit:performance:ci
```

Bun:

```bash
bun add -D @vantus/hyperdrive-auditor
bunx hyperdrive-auditor init --preset next-turbo-prisma --ci github --sarif --budgets
bun run audit:performance:ci
```

pnpm:

```bash
pnpm add -D @vantus/hyperdrive-auditor
pnpm exec hyperdrive-auditor init --preset next-turbo-prisma --ci github --sarif --budgets
pnpm audit:performance:ci
```

## Guided mode

Run the CLI without arguments in an interactive terminal:

```bash
hyperdrive-auditor
```

The wizard asks what you want to do, then collects the missing inputs instead of failing. It can run audits, initialize a repo, verify installation, plan safe fixes, explain a rule, or print the recommended enterprise workflow.

You can also start it explicitly:

```bash
hyperdrive-auditor guide
hyperdrive-auditor --guided
```

In non-interactive shells, no-argument usage prints complete help and exits successfully.

## CLI

```bash
hyperdrive-auditor audit --root .
hyperdrive-auditor --root .
hyperdrive-auditor init --root .
hyperdrive-auditor doctor --root .
hyperdrive-auditor fix --root . --fix-rule value-import-used-only-as-type
```

`hyperdrive-auditor --root .` remains valid for backwards compatibility. `hyperdrive-auditor` with no arguments opens guided mode in a TTY and prints help in non-interactive environments.

## Init

```bash
hyperdrive-auditor init --root . --ci github --sarif --budgets
```

`init` writes:

- `hyperdrive.config.json`
- audit scripts into `package.json`
- Hyperdrive artifact patterns into `.gitignore`
- `.github/workflows/hyperdrive-auditor.yml` when GitHub CI is enabled

Use `--dry-run` to preview changes.

## Doctor

```bash
hyperdrive-auditor doctor --root .
hyperdrive-auditor doctor --root . --format json
```

Doctor verifies config, scripts, dependency declaration, artifact ignores, and CI wiring.

## Config

Supported config names:

- `hyperdrive.config.json`
- `hyperdrive.config.jsonc`
- `.hyperdriverc`
- `.hyperdriverc.json`
- `.hyperdrive-auditor.json`

Example:

```json
{
  "profile": "balanced",
  "failOn": "high",
  "minSeverity": "info",
  "ignoreRules": [],
  "budgets": {
    "clientMaxModules": 120,
    "clientMaxLines": 12000,
    "clientMaxHeavyImports": 0,
    "maxServerReachableFromClient": 0,
    "maxCycles": 0
  },
  "frameworks": {
    "next": true,
    "prisma": true,
    "tailwind": true,
    "turborepo": true
  }
}
```

## Reports, recommendations, and artifacts

Every audit can emit recommendations based on the findings. Pretty output prints recommended next commands. Markdown and JSON outputs include the same recommendation data.

```bash
hyperdrive-auditor --root . --format markdown --output hyperdrive-report.md
hyperdrive-auditor --root . --sarif-output hyperdrive.sarif
hyperdrive-auditor --root . --budget-output hyperdrive-budget.json --budget-fail
hyperdrive-auditor --root . --graph-output hyperdrive-graph.json --type-report-output hyperdrive-type-report.json
hyperdrive-auditor --root . --fix-dry-run --fix-report-output hyperdrive-fix-report.json --no-fail
```

## Rules

```bash
hyperdrive-auditor --list-rules
hyperdrive-auditor --explain-rule client-graph-imports-server-code
```

## Safe fixes

```bash
hyperdrive-auditor --root . --fix-dry-run --fix-report-output hyperdrive-fix-report.json --no-fail
hyperdrive-auditor fix --root . --fix-rule value-import-used-only-as-type
```

Safe fixes include import-type conversion, server/client markers, workspace dependency declarations, root private flag, and Turbo pipeline migration. Risky architecture changes remain manual.

## Next.js config wrapper

```js
import { withHyperdrive } from '@vantus/hyperdrive-auditor/withHyperdrive';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

export default withHyperdrive(nextConfig, {
  enableSecurityHeaders: true,
  enablePoweredByHeaderOff: true,
  enableTypedRoutes: true,
  enableCacheComponents: false,
  enableReactCompiler: false,
  enableStandaloneForDocker: false
});
```

## GitHub Actions

```yaml
name: Hyperdrive Auditor

on:
  pull_request:
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run audit:performance:ci
      - run: bun run audit:performance:sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: hyperdrive.sarif
```

## Exit codes

- `0`: success, no findings at/above `--fail-on`, help shown, or non-interactive no-argument help shown.
- `1`: findings met/exceeded `--fail-on`, or doctor failed required checks.
- `2`: fatal CLI/runtime error.

## Publishing

This package is configured for restricted scoped publishing by default:

```bash
npm publish --access restricted
```

Change `publishConfig.access` to `public` if publishing to the public npm registry.

## Local tarball install warning

When testing a packed tarball from a local clone, always prefix relative paths with `./` or use an absolute path.

```bash
npm install -D ./hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz
```

Do not run `npm install hyperdrive-audit/vantus-hyperdrive-auditor-8.0.4.tgz`; npm may treat that as a GitHub shorthand package spec instead of a local file.
