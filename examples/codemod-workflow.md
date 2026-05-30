# Hyperdrive safe codemod workflow

Hyperdrive codemods are guarded write operations. They are designed for large monorepos where the auditor should fix mechanical problems but never perform broad architectural refactors without review.

## Dry run

```bash
hyperdrive-auditor --root . --profile ci --codemod --codemod-output hyperdrive-codemod.json --no-fail
```

Review:

- `summary.candidates`
- `summary.rejected`
- `files[].patch`
- `files[].edits[].confidence`

## Apply all safe edits

```bash
hyperdrive-auditor --root . --profile ci --codemod-apply --codemod-output hyperdrive-codemod.json --no-fail
```

Backups are written to `.hyperdrive-codemod-backups/<timestamp>/...` by default.

## Apply in waves

```bash
hyperdrive-auditor --root . --codemod --codemod-rule import-type --codemod-output codemod-import-type.json --no-fail
hyperdrive-auditor --root . --codemod-apply --codemod-rule import-type --codemod-output codemod-import-type.json --no-fail
```

Supported rules:

- `import-type`
- `server-only`
- `client-only`
- `workspace-deps`
- `turbo-pipeline`
- `root-private`

## Post-apply gate

```bash
git diff
bun run lint
bun run typecheck
bun run test
bun run audit:performance:ci
```
