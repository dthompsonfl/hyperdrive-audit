# Changelog

## 8.0.1 - Unreleased

- Fixed package self-audit by adding source-package Hyperdrive config for CLI-package layout.
- Reworked init dependency installation to use a lazy, no-shell process execution path with fixed executable arguments.
- Added source-package quality workflow and env example for cleaner repository validation.
- Kept published CLI behavior backward-compatible with v8.0.0.

## 8.0.0 - Unreleased

- Converted package metadata from private drop-in workspace package to publish-ready CLI package.
- Added command routing for audit, init, doctor, and fix while preserving legacy flag-only audit usage.
- Added host-repo installer that writes config, scripts, GitHub Actions workflow, and artifact ignore patterns.
- Added doctor command to verify installation health.
- Added composite action.yml wrapper and GitHub Action usage example.
- Removed mandatory Next.js peer dependency so non-Next monorepos can install cleanly.
- Added npm prepack validation.

## 7.0.0 - Unreleased

- Split the monolithic executable into a thin CLI entrypoint and source module tree.
- Added config file support and CLI/config precedence.
- Added a rule registry with `--list-rules` and `--explain-rule`.
- Added env, Docker/deployment, expanded security, expanded Prisma, and package hygiene rules.
- Improved reports with line/column data, artifacts, richer JSON, and improved SARIF locations.
- Added safe fix aliases via `--fix`, `--fix-dry-run`, `--fix-rule`, and `--fix-report-output`.
- Added fixture and wrapper smoke tests.
- Added Hyperdrive config, SARIF workflow, package script examples, and generated artifact `.gitignore` entries.


## 6.0.0

- Added guarded codemod mode with dry-run and explicit apply modes.
- Added `--codemod-output`, `--codemod-rule`, `--codemod-backup-dir`, `--codemod-max-edits`, and `--no-codemod-backup`.
- Added safe `import-type` codemod using TypeChecker-derived value/type usage.
- Added safe server/client boundary marker codemods for `server-only` and `client-only`.
- Added workspace dependency manifest codemod for missing `workspace:*` dependencies.
- Added Turbo `pipeline` to `tasks` migration codemod.
- Added root package `private: true` codemod.
- Added backup creation, overlap rejection, edit caps, patch previews, and machine-readable codemod result artifacts.
- Added codemod backup directories to default scan ignores.

## 5.0.0

- Added array/tuple-aware serializability analysis to eliminate false positives on DTO arrays.
- Added Promise return unwrapping for Server Action signature audits.
- Added package manifest dependency analysis for undeclared external and workspace imports.
- Added Next route runtime graph audit for Edge segments importing Node/database-only code transitively.
- Added server-only/client boundary marker checks.
- Added SARIF 2.1.0 output for code scanning.
- Added client graph budget JSON output.
- Fixed runtime import regex escaping in scanner helpers.


## 4.0.0

- Added type-aware TypeScript Program + TypeChecker analysis.
- Added symbol-level import usage classification for value-vs-type usage.
- Added `value-import-used-only-as-type` and `type-only-import-used-as-value` rules.
- Added Client Component prop serializability analysis.
- Added Server Component to Client Component JSX prop serializability analysis.
- Added Server Action signature safety analysis.
- Added strict/CI surfaced semantic diagnostics.
- Added `--no-type-aware` and `--type-report-output`.
- Improved type-only import handling so erased imports do not contaminate runtime graphs.


## 3.0.0

- Added TypeScript compiler API AST graph engine.
- Added host-repo TypeScript resolution with graceful fallback when TypeScript is unavailable.
- Added resolved runtime import graph output via `--graph-output`.
- Added machine-readable autofix suggestions via `--fix-suggestions-output`.
- Added transitive client/server contamination detection.
- Added server runtime to client code contamination detection.
- Added mixed environment shared module detection.
- Added internal client barrel detection.
- Added heavy dependency reachability from client graph.
- Added app-to-app and package-to-app dependency inversion checks.
- Added strict-profile runtime import cycle detection.
- Updated README and examples for AST graph workflows.

## 2.0.0

- Added broad static checks for Next.js 16, React 19, Prisma 7, Turborepo 2, repo hygiene, CI, scripts, Tailwind/shadcn, and security headers.
