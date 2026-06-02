# Publishing Hyperdrive Auditor v8.0.7

This archive contains the complete npm package source in `package/` and the generated npm tarball:

- `vantus-hyperdrive-auditor-8.0.7.tgz`
- `npm/vantus-hyperdrive-auditor-8.0.7.tgz`

## Validate before publish

```bash
cd package
npm install
npm run syntax
npm test
npm run check
npm pack --dry-run
```

## Publish

Restricted/private scoped package:

```bash
cd package
npm publish --access restricted
```

Public package:

```bash
cd package
npm pkg set publishConfig.access=public
npm publish --access public
```

## Local tarball install

Always use `./` or an absolute path. Without `./`, npm may interpret the tarball path as a GitHub repo shorthand.

```bash
npm install -D ./hyperdrive-auditor-cli-npm-ready-v8.0.7/vantus-hyperdrive-auditor-8.0.7.tgz
# or
npm install -D /absolute/path/to/vantus-hyperdrive-auditor-8.0.7.tgz
```

## New high-value workflows in 8.0.7

```bash
# Fast critical triage for large repos
npx hyperdrive-auditor audit --root . --profile ci --critical-only --summary-only --fast --no-fail

# Root-cause artifacts
npx hyperdrive-auditor audit --root . --profile ci --critical-only --hotspots-output hyperdrive-hotspots.json --action-plan-output hyperdrive-critical-plan.json --no-fail

# Baseline adoption
npx hyperdrive-auditor audit --root . --profile ci --write-baseline hyperdrive-baseline.json --no-fail
npx hyperdrive-auditor audit --root . --profile ci --baseline hyperdrive-baseline.json --fail-on-new --fail-on high
```
