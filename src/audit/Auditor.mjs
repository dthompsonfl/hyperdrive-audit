#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const VERSION = '8.0.4';
const moduleRequire = createRequire(import.meta.url);

const SEVERITY_ORDER = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const DEFAULT_IGNORES = new Set([
  '.git',
  '.hyperdrive',
  '.hyperdrive-codemod-backups',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  'coverage',
  'dist',
  'build',
  'node_modules',
  'playwright-report',
  'storybook-static',
  'examples',
  'test',
  'tests',
  'fixtures',
  '__fixtures__',
]);

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.prisma',
  '.mdx',
  '.css',
  '.yml',
  '.yaml',
  '.toml',
]);

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mdx']);
const APP_SOURCE_EXTENSIONS = new Set(['.jsx', '.tsx', '.js', '.ts', '.mdx']);
const NEXT_CONFIG_FILES = ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts'];
const PRISMA_CONFIG_FILES = [
  'prisma.config.ts',
  'prisma.config.js',
  'prisma.config.mjs',
  'prisma.config.cjs',
  '.config/prisma.ts',
  '.config/prisma.js',
  '.config/prisma.mjs',
  '.config/prisma.cjs',
];
const LOCK_FILES = ['bun.lockb', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'];
const HEAVY_CLIENT_IMPORTS = [
  'moment',
  'lodash',
  'lodash/fp',
  'date-fns/locale',
  'chart.js',
  'recharts',
  'framer-motion',
  '@tanstack/react-table',
];
const SERVER_ONLY_IMPORTS = [
  'fs',
  'node:fs',
  'path',
  'node:path',
  'crypto',
  'node:crypto',
  'child_process',
  'node:child_process',
  'net',
  'node:net',
  'tls',
  'node:tls',
  'dns',
  'node:dns',
  'server-only',
  'next/headers',
  'next/cache',
  '@prisma/client',
  'prisma',
  'stripe',
  'bcrypt',
  'bcryptjs',
  'argon2',
];
const NODE_EDGE_RISK_IMPORTS = [
  '@prisma/client',
  'prisma',
  'fs',
  'node:fs',
  'path',
  'node:path',
  'crypto',
  'node:crypto',
  'child_process',
  'sharp',
  'bcrypt',
  'bcryptjs',
  'argon2',
  'stripe',
  'pg',
  'mysql2',
  'mariadb',
];

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    format: 'pretty',
    output: null,
    failOn: 'high',
    minSeverity: 'info',
    maxFileSizeKb: 768,
    include: [],
    exclude: [],
    strict: false,
    profile: 'balanced',
    ast: true,
    typeAware: true,
    graphOutput: null,
    typeReportOutput: null,
    fixSuggestionsOutput: null,
    sarifOutput: null,
    budgetOutput: null,
    codemod: false,
    codemodApply: false,
    codemodOutput: null,
    codemodRules: [],
    codemodBackup: true,
    codemodBackupDir: '.hyperdrive-codemod-backups',
    codemodMaxEdits: 200,
    configPath: null,
    ignoreRules: [],
    listRules: false,
    explainRule: null,
    budgetFail: false,
    fix: false,
    fixDryRun: false,
    fixRules: [],
    fixReportOutput: null,
    help: false,
    version: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--root':
        options.root = argv[++index] || options.root;
        break;
      case '--format':
        options.format = argv[++index] || options.format;
        break;
      case '--output':
        options.output = argv[++index] || null;
        break;
      case '--fail-on':
        options.failOn = normalizeSeverity(argv[++index] || options.failOn);
        break;
      case '--min-severity':
        options.minSeverity = normalizeSeverity(argv[++index] || options.minSeverity);
        break;
      case '--max-file-size-kb':
        options.maxFileSizeKb = Number(argv[++index] || options.maxFileSizeKb);
        break;
      case '--include':
        options.include.push(argv[++index] || '');
        break;
      case '--exclude':
        options.exclude.push(argv[++index] || '');
        break;
      case '--profile':
        options.profile = String(argv[++index] || options.profile).toLowerCase();
        break;
      case '--no-ast':
        options.ast = false;
        options.typeAware = false;
        break;
      case '--no-type-aware':
        options.typeAware = false;
        break;
      case '--type-report-output':
        options.typeReportOutput = argv[++index] || null;
        break;
      case '--graph-output':
        options.graphOutput = argv[++index] || null;
        break;
      case '--fix-suggestions-output':
        options.fixSuggestionsOutput = argv[++index] || null;
        break;
      case '--sarif-output':
        options.sarifOutput = argv[++index] || null;
        break;
      case '--budget-output':
        options.budgetOutput = argv[++index] || null;
        break;
      case '--codemod':
        options.codemod = true;
        break;
      case '--codemod-apply':
        options.codemod = true;
        options.codemodApply = true;
        break;
      case '--codemod-output':
        options.codemodOutput = argv[++index] || null;
        break;
      case '--codemod-rule':
        options.codemodRules.push(argv[++index] || '');
        break;
      case '--codemod-backup-dir':
        options.codemodBackupDir = argv[++index] || options.codemodBackupDir;
        break;
      case '--codemod-max-edits':
        options.codemodMaxEdits = Number(argv[++index] || options.codemodMaxEdits);
        break;
      case '--no-codemod-backup':
        options.codemodBackup = false;
        break;
      case '--config':
        options.configPath = argv[++index] || null;
        break;
      case '--ignore-rule':
        options.ignoreRules.push(argv[++index] || '');
        break;
      case '--list-rules':
        options.listRules = true;
        break;
      case '--explain-rule':
        options.explainRule = argv[++index] || '';
        break;
      case '--budget-fail':
        options.budgetFail = true;
        break;
      case '--fix':
        options.fix = true;
        options.codemod = true;
        options.codemodApply = true;
        break;
      case '--fix-dry-run':
        options.fixDryRun = true;
        options.codemod = true;
        options.codemodApply = false;
        break;
      case '--fix-rule':
        options.fixRules.push(argv[++index] || '');
        options.codemodRules.push(options.fixRules[options.fixRules.length - 1]);
        break;
      case '--fix-report-output':
        options.fixReportOutput = argv[++index] || null;
        options.codemodOutput = options.fixReportOutput;
        break;
      case '--strict':
        options.strict = true;
        options.profile = 'strict';
        break;
      case '--no-fail':
        options.failOn = 'never';
        break;
      case '--version':
      case '-v':
        options.version = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
    }
  }

  if (!['pretty', 'json', 'markdown'].includes(options.format)) {
    throw new Error('--format must be one of: pretty, json, markdown');
  }

  if (!['balanced', 'strict', 'ci'].includes(options.profile)) {
    throw new Error('--profile must be one of: balanced, strict, ci');
  }

  if (options.failOn !== 'never' && !(options.failOn in SEVERITY_ORDER)) {
    throw new Error('--fail-on must be one of: never, info, low, medium, high, critical');
  }

  if (!(options.minSeverity in SEVERITY_ORDER)) {
    throw new Error('--min-severity must be one of: info, low, medium, high, critical');
  }

  if (!Number.isFinite(options.codemodMaxEdits) || options.codemodMaxEdits < 1) {
    throw new Error('--codemod-max-edits must be a positive number');
  }

  return options;
}

function normalizeSeverity(value) {
  return String(value || '').trim().toLowerCase();
}

function printHelp() {
  console.log(`Hyperdrive Auditor v${VERSION}

Usage:
  hyperdrive-auditor [options]

Options:
  --root <path>             Monorepo root. Defaults to cwd.
  --format <type>           pretty | json | markdown. Defaults to pretty.
  --output <path>           Write report to a file.
  --fail-on <severity>      never | info | low | medium | high | critical. Defaults to high.
  --min-severity <severity> Hide findings below severity. Defaults to info.
  --max-file-size-kb <n>    Skip very large files. Defaults to 768.
  --include <fragment>      Restrict scan to paths containing this fragment. Repeatable.
  --exclude <fragment>      Exclude paths containing this fragment. Repeatable.
  --profile <profile>       balanced | strict | ci. Defaults to balanced.
  --no-ast                  Disable TypeScript compiler API import graph analysis.
  --no-type-aware           Keep syntax import graph, but disable TypeChecker semantic analysis.
  --graph-output <path>     Write resolved import graph JSON for debugging/boundary reviews.
  --type-report-output <path>
                            Write TypeChecker-derived symbol/prop/signature report JSON.
  --fix-suggestions-output <path>
                            Write machine-readable autofix suggestions JSON.
  --sarif-output <path>     Write SARIF 2.1.0 for GitHub code scanning.
  --budget-output <path>    Write client/runtime graph budget report JSON.
  --codemod                 Plan safe codemods without writing files.
  --codemod-apply           Apply safe codemods. Creates backups unless disabled.
  --codemod-output <path>   Write codemod plan/result JSON.
  --codemod-rule <rule>     Restrict codemods to a rule: import-type, server-only, client-only, workspace-deps, turbo-pipeline, root-private. Repeatable.
  --codemod-backup-dir <p>  Backup directory for --codemod-apply. Defaults to .hyperdrive-codemod-backups.
  --codemod-max-edits <n>   Maximum safe edits per run. Defaults to 200.
  --no-codemod-backup       Disable backups when applying codemods. Use only in clean git worktrees.
  --config <path>           Load hyperdrive config JSON/JSONC file.
  --ignore-rule <rule>      Ignore a rule id. Repeatable.
  --list-rules              Print the rule registry.
  --explain-rule <rule>     Explain one rule and exit.
  --budget-fail             Treat graph budget failures as audit findings.
  --fix-dry-run             Alias for safe codemod planning.
  --fix                     Apply safe fixes only. Creates backups unless disabled.
  --fix-rule <rule>         Restrict safe fixes to a rule. Repeatable.
  --fix-report-output <p>   Write safe fix report JSON.
  --strict                  Alias for --profile strict.
  --no-fail                 Always exit 0.
  -v, --version             Print version.
  -h, --help                Show help.

Examples:
  hyperdrive-auditor --root .
  hyperdrive-auditor --format markdown --output hyperdrive-report.md
  hyperdrive-auditor --profile ci --fail-on medium
`);
}

class HyperdriveAuditor {
  constructor(options) {
    this.options = options;
    this.root = resolve(options.root);
    this.files = [];
    this.findings = [];
    this.jsonCache = new Map();
    this.textCache = new Map();
    this.packageIndex = [];
    this.workspacePackages = [];
    this.ts = null;
    this.tsConfigCache = new Map();
    this.astGraph = null;
    this.typeGraph = null;
    this.autofixSuggestions = [];
    this.codemodResult = null;
    this.budgetFailed = false;
  }

  run() {
    this.assertRoot();
    this.indexFiles(this.root);
    this.buildPackageIndex();
    this.buildAstGraph();
    this.buildTypeAwareGraph();

    this.auditWorkspaceShape();
    this.auditPackageManager();
    this.auditPackageVersions();
    this.auditTurborepoConfig();
    this.auditTsConfig();
    this.auditNextConfigs();
    this.auditPackageScripts();
    this.auditSourceFiles();
    this.auditEnvironment();
    this.auditDockerAndDeployment();
    this.auditExpandedSecurity();
    this.auditExpandedPackageChecks();
    this.auditAstImportGraph();
    this.auditTypeAwareGraph();
    this.auditDependencyManifests();
    this.auditNextRouteRuntimeGraph();
    this.auditServerClientMarkers();
    this.auditPrisma();
    this.auditExpandedPrisma();
    this.auditTailwindAndShadcn();
    this.auditCiAndRepoQuality();
    this.auditLockfileStrategy();
    this.runCodemods();
    this.writeOptionalArtifacts();

    return this.getVisibleFindings();
  }

  assertRoot() {
    if (!existsSync(this.root) || !statSync(this.root).isDirectory()) {
      throw new Error(`Root does not exist or is not a directory: ${this.root}`);
    }
  }

  indexFiles(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (DEFAULT_IGNORES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && DEFAULT_IGNORES.has(entry.name)) continue;

      const fullPath = join(dir, entry.name);
      const rel = this.rel(fullPath);

      if (this.options.exclude.some((fragment) => fragment && rel.includes(fragment))) continue;
      if (this.options.include.length > 0 && !this.options.include.some((fragment) => rel.includes(fragment))) continue;

      if (entry.isDirectory()) {
        this.indexFiles(fullPath);
        continue;
      }

      const extension = extname(entry.name);
      const textName = /^(Dockerfile|Containerfile)$/.test(entry.name) || /docker-compose.*\.ya?ml$|compose.*\.ya?ml$/i.test(entry.name);
      if (!TEXT_EXTENSIONS.has(extension) && !textName) continue;

      const sizeKb = statSync(fullPath).size / 1024;
      if (sizeKb > this.options.maxFileSizeKb) {
        this.add({
          severity: 'low',
          category: 'repository',
          rule: 'large-file-skipped',
          file: rel,
          message: `Skipped static analysis for a large file (${Math.round(sizeKb)}KB).`,
          fix: 'Lower --max-file-size-kb if this file should be scanned.',
        });
        continue;
      }

      this.files.push(fullPath);
    }
  }

  buildPackageIndex() {
    const packageFiles = this.files.filter((file) => basename(file) === 'package.json');
    for (const file of packageFiles) {
      const rel = this.rel(file);
      const json = this.readJson(rel);
      if (!json) continue;
      const dir = dirname(file);
      this.packageIndex.push({ rel, file, dir, json, deps: getAllDeps(json), directDeps: getDirectDeps(json) });
      if (rel !== 'package.json') this.workspacePackages.push({ rel, file, dir, json, deps: getAllDeps(json), directDeps: getDirectDeps(json) });
    }
  }


  loadTypeScript() {
    if (process.env.HYPERDRIVE_DISABLE_TYPESCRIPT === '1') {
      this.ts = false;
      return null;
    }
    if (this.ts !== null) return this.ts;
    const candidates = [];
    const rootPackagePath = join(this.root, 'package.json');
    if (existsSync(rootPackagePath)) candidates.push(createRequire(rootPackagePath));
    candidates.push(moduleRequire);

    for (const req of candidates) {
      try {
        this.ts = req('typescript');
        return this.ts;
      } catch {
        // Try the next resolution base.
      }
    }

    this.ts = false;
    if (this.usesTypeScript()) {
      this.add({
        severity: 'medium',
        category: 'typescript',
        rule: 'typescript-compiler-api-unavailable',
        file: 'package.json',
        message: 'TypeScript source was detected, but the auditor could not load the typescript package for AST graph analysis.',
        fix: 'Install TypeScript in the root workspace or in the auditor package so Hyperdrive can resolve imports with the compiler API.',
        autofix: {
          kind: 'package-manager',
          confidence: 'high',
          title: 'Install TypeScript for AST analysis',
          commands: ['bun add -D typescript'],
        },
      });
    }
    return null;
  }

  buildAstGraph() {
    if (!this.options.ast) return;
    const ts = this.loadTypeScript();
    if (!ts) {
      this.buildTextImportGraph();
      return;
    }

    const nodes = new Map();
    const edges = [];
    const sourceFiles = this.files.filter((file) => {
      const ext = extname(file);
      if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return false;
      if (file.endsWith('.d.ts')) return false;
      return !/\/generated\//.test(this.rel(file));
    });

    for (const file of sourceFiles) {
      const content = this.readFile(file);
      const rel = this.rel(file);
      const scriptKind = this.getScriptKind(ts, file);
      let sourceFile;
      try {
        sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind);
      } catch (error) {
        this.add({
          severity: 'medium',
          category: 'typescript',
          rule: 'ast-parse-failed',
          file: rel,
          message: `TypeScript AST parse failed: ${error.message}`,
          fix: 'Run tsc --noEmit and fix syntax errors before relying on static architecture analysis.',
        });
        continue;
      }

      const node = {
        file,
        rel,
        directives: this.getAstDirectives(ts, sourceFile),
        imports: [],
        exports: [],
        dynamicImports: [],
        externalImports: new Set(),
        internalImports: new Set(),
        typeOnlyImports: new Set(),
        serverOnlyImports: new Set(),
        clientOnlyImports: new Set(),
        heavyClientImports: new Set(),
        barrelExportCount: 0,
        hasJsx: false,
        usesBrowserApi: false,
        usesServerEnv: false,
        usesProcessEnv: false,
        usesReactClientHook: false,
        usesServerActionDirective: false,
        lineCount: content.split('\n').length,
      };

      const addImport = (specifier, kind, isTypeOnly, start) => {
        if (!specifier) return;
        const resolved = this.resolveImportWithTypeScript(ts, file, specifier);
        const importRecord = {
          specifier,
          kind,
          typeOnly: Boolean(isTypeOnly),
          resolvedFile: resolved?.file || null,
          resolvedRel: resolved?.rel || null,
          external: !resolved?.rel,
          line: this.getLineOfPosition(sourceFile, start),
        };
        node.imports.push(importRecord);
        if (kind === 'dynamic') node.dynamicImports.push(importRecord);
        if (isTypeOnly) node.typeOnlyImports.add(specifier);
        if (importRecord.resolvedRel && !isTypeOnly) node.internalImports.add(importRecord.resolvedRel);
        if (!importRecord.resolvedRel && !isTypeOnly) node.externalImports.add(specifier);
        if (!isTypeOnly && (SERVER_ONLY_IMPORTS.includes(specifier) || NODE_EDGE_RISK_IMPORTS.includes(specifier))) node.serverOnlyImports.add(specifier);
        if (!isTypeOnly && specifier === 'client-only') node.clientOnlyImports.add(specifier);
        if (!isTypeOnly && HEAVY_CLIENT_IMPORTS.some((heavy) => specifier === heavy || specifier.startsWith(`${heavy}/`))) node.heavyClientImports.add(specifier);
        edges.push({ from: rel, to: importRecord.resolvedRel || specifier, specifier, typeOnly: Boolean(isTypeOnly), external: !importRecord.resolvedRel, kind, line: importRecord.line });
      };

      const visit = (astNode) => {
        if (ts.isImportDeclaration(astNode) && ts.isStringLiteral(astNode.moduleSpecifier)) {
          const isTypeOnly = Boolean(astNode.importClause?.isTypeOnly);
          addImport(astNode.moduleSpecifier.text, 'static', isTypeOnly, astNode.getStart(sourceFile));
        } else if (ts.isExportDeclaration(astNode) && astNode.moduleSpecifier && ts.isStringLiteral(astNode.moduleSpecifier)) {
          node.barrelExportCount += 1;
          addImport(astNode.moduleSpecifier.text, 'export', Boolean(astNode.isTypeOnly), astNode.getStart(sourceFile));
        } else if (ts.isCallExpression(astNode)) {
          const expressionText = astNode.expression.getText(sourceFile);
          const firstArg = astNode.arguments?.[0];
          if (expressionText === 'require' && firstArg && ts.isStringLiteral(firstArg)) {
            addImport(firstArg.text, 'require', false, astNode.getStart(sourceFile));
          }
          if (expressionText === 'import' && firstArg && ts.isStringLiteral(firstArg)) {
            addImport(firstArg.text, 'dynamic', false, astNode.getStart(sourceFile));
          }
          if (/^(useState|useEffect|useLayoutEffect|useReducer|useRef|useTransition|useOptimistic|useActionState)$/.test(expressionText)) {
            node.usesReactClientHook = true;
          }
        } else if (ts.isIdentifier(astNode)) {
          const text = astNode.getText(sourceFile);
          if (/^(window|document|localStorage|sessionStorage|navigator|matchMedia|ResizeObserver|IntersectionObserver|MutationObserver)$/.test(text)) {
            node.usesBrowserApi = true;
          }
          if (text === 'process') node.usesProcessEnv = true;
        } else if (ts.isJsxElement?.(astNode) || ts.isJsxSelfClosingElement?.(astNode) || ts.isJsxFragment?.(astNode)) {
          node.hasJsx = true;
        } else if (ts.isExpressionStatement(astNode) && ts.isStringLiteral(astNode.expression) && astNode.expression.text === 'use server') {
          node.usesServerActionDirective = true;
        }
        ts.forEachChild(astNode, visit);
      };

      visit(sourceFile);
      node.usesServerEnv = /process\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]+/.test(content);
      nodes.set(rel, node);
    }

    this.astGraph = { nodes, edges, sourceFileCount: sourceFiles.length };
  }


  buildTextImportGraph() {
    const nodes = new Map();
    const edges = [];
    const sourceFiles = this.files.filter((file) => {
      const ext = extname(file);
      if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return false;
      if (file.endsWith('.d.ts')) return false;
      return !/\/generated\//.test(this.rel(file));
    });

    const getLineForIndex = (content, index) => content.slice(0, Math.max(0, index)).split('\n').length;

    for (const file of sourceFiles) {
      const content = this.readFile(file);
      const rel = this.rel(file);
      const node = {
        file,
        rel,
        directives: this.getTextDirectives(content),
        imports: [],
        exports: [],
        dynamicImports: [],
        externalImports: new Set(),
        internalImports: new Set(),
        typeOnlyImports: new Set(),
        serverOnlyImports: new Set(),
        clientOnlyImports: new Set(),
        heavyClientImports: new Set(),
        barrelExportCount: 0,
        hasJsx: /<\s*[A-Za-z][\w:.]*(\s|>|\/)/.test(content),
        usesBrowserApi: /\b(window|document|localStorage|sessionStorage|navigator|matchMedia|ResizeObserver|IntersectionObserver|MutationObserver)\b/.test(content),
        usesServerEnv: /process\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]+/.test(content),
        usesProcessEnv: /\bprocess\.env\b/.test(content),
        usesReactClientHook: /\b(useState|useEffect|useLayoutEffect|useReducer|useRef|useTransition|useOptimistic|useActionState)\s*\(/.test(content),
        usesServerActionDirective: /(^|\n)\s*['"]use server['"]\s*;?/.test(content),
        lineCount: content.split('\n').length,
      };

      const addImport = (specifier, kind, isTypeOnly, index) => {
        if (!specifier) return;
        const resolved = this.resolveImportManually(file, specifier);
        const importRecord = {
          specifier,
          kind,
          typeOnly: Boolean(isTypeOnly),
          resolvedFile: resolved?.file || null,
          resolvedRel: resolved?.rel || null,
          external: !resolved?.rel,
          line: getLineForIndex(content, index),
        };
        node.imports.push(importRecord);
        if (kind === 'export') node.exports.push(importRecord);
        if (kind === 'dynamic') node.dynamicImports.push(importRecord);
        if (isTypeOnly) node.typeOnlyImports.add(specifier);
        if (importRecord.resolvedRel && !isTypeOnly) node.internalImports.add(importRecord.resolvedRel);
        if (!importRecord.resolvedRel && !isTypeOnly) node.externalImports.add(specifier);
        if (!isTypeOnly && (SERVER_ONLY_IMPORTS.includes(specifier) || NODE_EDGE_RISK_IMPORTS.includes(specifier))) node.serverOnlyImports.add(specifier);
        if (!isTypeOnly && specifier === 'client-only') node.clientOnlyImports.add(specifier);
        if (!isTypeOnly && HEAVY_CLIENT_IMPORTS.some((heavy) => specifier === heavy || specifier.startsWith(`${heavy}/`))) node.heavyClientImports.add(specifier);
        edges.push({ from: rel, to: importRecord.resolvedRel || specifier, specifier, typeOnly: Boolean(isTypeOnly), external: !importRecord.resolvedRel, kind, line: importRecord.line });
      };

      const patterns = [
        { kind: 'static', regex: /\bimport\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g },
        { kind: 'export', regex: /\bexport\s+(type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g },
        { kind: 'require', regex: /\b(?:require|module\.require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
        { kind: 'dynamic', regex: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.regex.exec(content))) {
          if (pattern.kind === 'static' || pattern.kind === 'export') addImport(match[2], pattern.kind, Boolean(match[1]), match.index);
          else addImport(match[1], pattern.kind, false, match.index);
        }
      }

      nodes.set(rel, node);
    }

    this.astGraph = { nodes, edges, sourceFileCount: sourceFiles.length, fallback: true };
  }

  getTextDirectives(content) {
    const directives = new Set();
    const prefix = content.slice(0, 500);
    for (const match of prefix.matchAll(/^\s*['"](use client|use server|use cache)['"]\s*;?/gm)) directives.add(match[1]);
    return directives;
  }

  getScriptKind(ts, file) {
    const ext = extname(file);
    if (ext === '.tsx') return ts.ScriptKind.TSX;
    if (ext === '.jsx') return ts.ScriptKind.JSX;
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS;
    return ts.ScriptKind.TS;
  }

  getAstDirectives(ts, sourceFile) {
    const directives = new Set();
    for (const statement of sourceFile.statements) {
      if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
        directives.add(statement.expression.text);
        continue;
      }
      break;
    }
    return directives;
  }

  getLineOfPosition(sourceFile, position) {
    const location = sourceFile.getLineAndCharacterOfPosition(position);
    return location.line + 1;
  }

  getCompilerOptionsForFile(ts, file) {
    const configPath = ts.findConfigFile(dirname(file), ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
      return {
        allowJs: true,
        jsx: ts.JsxEmit.Preserve,
        moduleResolution: ts.ModuleResolutionKind.Bundler || ts.ModuleResolutionKind.NodeNext,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        baseUrl: this.root,
      };
    }

    if (this.tsConfigCache.has(configPath)) return this.tsConfigCache.get(configPath);

    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    if (read.error) {
      const options = { allowJs: true, jsx: ts.JsxEmit.Preserve, baseUrl: dirname(configPath) };
      this.tsConfigCache.set(configPath, options);
      return options;
    }

    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath), undefined, configPath);
    const options = parsed.options || {};
    this.tsConfigCache.set(configPath, options);
    return options;
  }

  resolveImportWithTypeScript(ts, fromFile, specifier) {
    if (isBuiltinSpecifier(specifier)) return null;
    try {
      const options = this.getCompilerOptionsForFile(ts, fromFile);
      const resolved = ts.resolveModuleName(specifier, fromFile, options, ts.sys).resolvedModule;
      if (resolved?.resolvedFileName) {
        const file = resolved.resolvedFileName.replaceAll('\\', '/');
        if (file.includes('/node_modules/') || file.endsWith('.d.ts')) return null;
        if (file.startsWith(this.root.replaceAll('\\', '/'))) {
          return { file, rel: this.rel(file) };
        }
      }
    } catch {
      // Fall back to conservative manual resolution.
    }
    return this.resolveImportManually(fromFile, specifier);
  }

  resolveImportManually(fromFile, specifier) {
    if (!specifier.startsWith('.') && !specifier.startsWith('@/') && !specifier.startsWith('~/')) return null;
    const base = specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
      : resolve(this.root, specifier.replace(/^[@~]\//, ''));
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.mjs`,
      `${base}.cjs`,
      join(base, 'index.ts'),
      join(base, 'index.tsx'),
      join(base, 'index.js'),
      join(base, 'index.jsx'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return { file: candidate, rel: this.rel(candidate) };
    }
    return null;
  }

  buildTypeAwareGraph() {
    if (!this.options.ast || !this.options.typeAware || !this.astGraph) return;
    const ts = this.loadTypeScript();
    if (!ts) return;

    const programEntries = this.createTypeScriptPrograms(ts);
    if (programEntries.length === 0) return;

    const nodes = new Map();
    const componentDeclarations = new Map();
    const diagnostics = [];
    const analyzedFiles = new Set();

    for (const entry of programEntries) {
      let checker;
      try {
        checker = entry.program.getTypeChecker();
      } catch (error) {
        this.add({
          severity: 'medium',
          category: 'typescript',
          rule: 'type-checker-unavailable',
          file: entry.configRel,
          message: `Could not initialize TypeScript TypeChecker: ${error.message}`,
          fix: 'Run tsc --noEmit and fix project configuration errors before relying on type-aware architecture analysis.',
        });
        continue;
      }

      const semanticDiagnostics = this.safeGetSemanticDiagnostics(ts, entry.program);
      for (const diagnostic of semanticDiagnostics.slice(0, 50)) {
        const rel = diagnostic.file ? this.rel(diagnostic.file.fileName) : entry.configRel;
        diagnostics.push({ file: rel, code: diagnostic.code, message: flattenTsDiagnostic(ts, diagnostic.messageText) });
      }

      for (const sourceFile of entry.program.getSourceFiles()) {
        const fileName = normalizeFileName(sourceFile.fileName);
        if (sourceFile.isDeclarationFile || !fileName.startsWith(normalizeFileName(this.root)) || fileName.includes('/node_modules/')) continue;
        if (analyzedFiles.has(fileName)) continue;
        analyzedFiles.add(fileName);
        const rel = this.rel(fileName);
        if (!this.astGraph.nodes.has(rel)) continue;
        const typeNode = this.analyzeTypeAwareSourceFile(ts, entry.program, checker, sourceFile, entry.configRel, componentDeclarations);
        nodes.set(rel, typeNode);
      }
    }

    this.typeGraph = {
      nodes,
      componentDeclarations,
      diagnostics,
      programCount: programEntries.length,
      analyzedFileCount: nodes.size,
    };
  }

  createTypeScriptPrograms(ts) {
    const configFiles = this.files
      .filter((file) => basename(file) === 'tsconfig.json')
      .filter((file) => !this.rel(file).includes('/examples/'));

    const entries = [];
    const usedSourceFiles = new Set();

    for (const configFile of configFiles) {
      try {
        const read = ts.readConfigFile(configFile, ts.sys.readFile);
        if (read.error) continue;
        const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configFile), {
          noEmit: true,
          skipLibCheck: true,
        }, configFile);
        const rootNames = parsed.fileNames.filter((file) => this.isAnalyzableTsProgramFile(file));
        if (rootNames.length === 0) continue;
        const options = {
          ...parsed.options,
          allowJs: parsed.options.allowJs ?? true,
          checkJs: parsed.options.checkJs ?? false,
          noEmit: true,
          skipLibCheck: true,
          jsx: parsed.options.jsx ?? ts.JsxEmit.Preserve,
          moduleResolution: parsed.options.moduleResolution ?? ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.NodeNext,
          module: parsed.options.module ?? ts.ModuleKind.ESNext,
          target: parsed.options.target ?? ts.ScriptTarget.ES2022,
        };
        const program = ts.createProgram(rootNames, options);
        for (const file of rootNames) usedSourceFiles.add(normalizeFileName(file));
        entries.push({ configFile, configRel: this.rel(configFile), program, rootNames });
      } catch (error) {
        this.add({
          severity: 'medium',
          category: 'typescript',
          rule: 'ts-program-create-failed',
          file: this.rel(configFile),
          message: `Failed to create TypeScript Program: ${error.message}`,
          fix: 'Run tsc --showConfig for this package and fix invalid compiler options/includes.',
        });
      }
    }

    const leftover = this.files
      .filter((file) => this.isAnalyzableTsProgramFile(file))
      .filter((file) => !usedSourceFiles.has(normalizeFileName(file)));

    if (leftover.length > 0) {
      try {
        const fallbackOptions = {
          allowJs: true,
          checkJs: false,
          noEmit: true,
          skipLibCheck: true,
          jsx: ts.JsxEmit.Preserve,
          moduleResolution: ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.NodeNext,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          baseUrl: this.root,
        };
        entries.push({ configFile: null, configRel: '<fallback>', program: ts.createProgram(leftover, fallbackOptions), rootNames: leftover });
      } catch (error) {
        this.add({
          severity: 'low',
          category: 'typescript',
          rule: 'fallback-ts-program-create-failed',
          message: `Fallback TypeScript Program failed: ${error.message}`,
          fix: 'Add tsconfig.json files to all source packages so Hyperdrive can use precise compiler options.',
        });
      }
    }

    return entries;
  }

  isAnalyzableTsProgramFile(file) {
    const rel = this.rel(file);
    if (/\/(node_modules|\.next|\.turbo|dist|build|coverage)\//.test(`/${rel}`)) return false;
    if (file.endsWith('.d.ts')) return false;
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extname(file));
  }

  safeGetSemanticDiagnostics(ts, program) {
    if (!this.strictish()) return [];
    try {
      return program.getSemanticDiagnostics();
    } catch {
      return [];
    }
  }

  analyzeTypeAwareSourceFile(ts, program, checker, sourceFile, configRel, componentDeclarations) {
    const rel = this.rel(sourceFile.fileName);
    const astNode = this.astGraph.nodes.get(rel);
    const importSymbols = new Map();
    const importLocals = new Map();
    const importedSymbols = [];
    const typeOnlyImportValueViolations = [];
    const typeImportOpportunities = [];
    const clientComponentPropIssues = [];
    const serverToClientPropIssues = [];
    const serverActionSignatureIssues = [];
    const exportedFunctionIssues = [];

    const addImportSymbol = (nameNode, importDecl, importedName, isTypeOnly) => {
      if (!nameNode) return null;
      const symbol = checker.getSymbolAtLocation(nameNode);
      if (!symbol) return null;
      const specifier = getModuleSpecifierText(ts, importDecl);
      if (!specifier) return null;
      const resolved = this.resolveImportWithTypeScript(ts, sourceFile.fileName, specifier);
      let aliased = null;
      try {
        aliased = checker.getAliasedSymbol(symbol);
      } catch {
        aliased = symbol;
      }
      const declarationRel = this.getSymbolDeclarationRel(aliased || symbol);
      const info = {
        localName: nameNode.getText(sourceFile),
        importedName,
        specifier,
        isTypeOnly: Boolean(isTypeOnly),
        resolvedRel: resolved?.rel || null,
        declarationRel,
        line: this.getLineOfPosition(sourceFile, importDecl.getStart(sourceFile)),
        usedAsValue: false,
        usedAsType: false,
      };
      importSymbols.set(symbol, info);
      importLocals.set(info.localName, info);
      importedSymbols.push(info);
      if (info.declarationRel) componentDeclarations.set(`${rel}:${info.localName}`, info.declarationRel);
      return info;
    };

    const visitImports = (node) => {
      if (ts.isImportDeclaration(node) && node.importClause) {
        const clause = node.importClause;
        if (clause.name) addImportSymbol(clause.name, node, 'default', clause.isTypeOnly);
        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            addImportSymbol(clause.namedBindings.name, node, '*', clause.isTypeOnly);
          } else if (ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
              addImportSymbol(element.name, node, element.propertyName?.getText(sourceFile) || element.name.getText(sourceFile), clause.isTypeOnly || Boolean(element.isTypeOnly));
            }
          }
        }
      }
      ts.forEachChild(node, visitImports);
    };

    visitImports(sourceFile);

    const visitUsage = (node) => {
      if (ts.isIdentifier(node) && !isIdentifierBindingInImport(ts, node)) {
        const symbol = checker.getSymbolAtLocation(node);
        const info = symbol ? importSymbols.get(symbol) : null;
        if (info) {
          if (isIdentifierInTypePosition(ts, node)) info.usedAsType = true;
          else info.usedAsValue = true;
        }
      }
      ts.forEachChild(node, visitUsage);
    };

    visitUsage(sourceFile);

    for (const info of importedSymbols) {
      if (info.isTypeOnly && info.usedAsValue) typeOnlyImportValueViolations.push(info);
      if (!info.isTypeOnly && info.usedAsType && !info.usedAsValue && info.importedName !== '*') typeImportOpportunities.push(info);
    }

    const sourceIsClientEntry = astNode?.directives?.has('use client');
    const sourceIsServerActionFile = astNode?.directives?.has('use server');

    const visitSemantic = (node) => {
      if (sourceIsClientEntry) {
        const component = this.getComponentDeclarationInfo(ts, checker, sourceFile, node);
        if (component?.isExported && component.firstParam) {
          const paramType = checker.getTypeAtLocation(component.firstParam);
          const issues = this.findNonSerializableTypeIssues(ts, checker, paramType, component.firstParam, 'props', 0, { allowReactNodeChildren: true, allowFormData: false });
          for (const issue of issues) clientComponentPropIssues.push({ ...issue, componentName: component.name, line: this.getLineOfPosition(sourceFile, node.getStart(sourceFile)) });
        }
      }

      if (sourceIsServerActionFile) {
        const fn = this.getExportedFunctionInfo(ts, sourceFile, node);
        if (fn?.isExported) {
          for (const param of fn.params) {
            const type = checker.getTypeAtLocation(param);
            const issues = this.findNonSerializableTypeIssues(ts, checker, type, param, `parameter ${param.name?.getText?.(sourceFile) || '<anonymous>'}`, 0, { allowReactNodeChildren: false, allowFormData: true });
            for (const issue of issues) serverActionSignatureIssues.push({ ...issue, functionName: fn.name, line: this.getLineOfPosition(sourceFile, param.getStart(sourceFile)) });
          }
          if (fn.node) {
            const signature = checker.getSignatureFromDeclaration(fn.node);
            const returnType = signature ? checker.getReturnTypeOfSignature(signature) : null;
            if (returnType) {
              const issues = this.findNonSerializableTypeIssues(ts, checker, returnType, fn.node, 'return value', 0, { allowReactNodeChildren: false, allowFormData: false, allowPromise: true });
              for (const issue of issues) serverActionSignatureIssues.push({ ...issue, functionName: fn.name, line: this.getLineOfPosition(sourceFile, fn.node.getStart(sourceFile)) });
            }
          }
        }
      }

      if (!sourceIsClientEntry && (ts.isJsxSelfClosingElement?.(node) || ts.isJsxOpeningElement?.(node))) {
        const tagInfo = this.getJsxImportedTagInfo(ts, checker, sourceFile, node, importLocals);
        if (tagInfo && this.isTypeAwareClientComponentTarget(tagInfo)) {
          const attrs = node.attributes?.properties || [];
          for (const attr of attrs) {
            if (ts.isJsxAttribute(attr)) {
              const propName = attr.name.getText(sourceFile);
              if (!attr.initializer || ts.isStringLiteral(attr.initializer)) continue;
              if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
                const expr = attr.initializer.expression;
                if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
                  serverToClientPropIssues.push({ propPath: propName, reason: 'function literal passed to Client Component', typeText: '<function>', line: this.getLineOfPosition(sourceFile, attr.getStart(sourceFile)), target: tagInfo.targetRel });
                } else {
                  const type = checker.getTypeAtLocation(expr);
                  const issues = this.findNonSerializableTypeIssues(ts, checker, type, expr, propName, 0, { allowReactNodeChildren: propName === 'children', allowFormData: false });
                  for (const issue of issues) serverToClientPropIssues.push({ ...issue, line: this.getLineOfPosition(sourceFile, attr.getStart(sourceFile)), target: tagInfo.targetRel });
                }
              }
            } else if (ts.isJsxSpreadAttribute(attr)) {
              const type = checker.getTypeAtLocation(attr.expression);
              const issues = this.findNonSerializableTypeIssues(ts, checker, type, attr.expression, 'spread props', 0, { allowReactNodeChildren: true, allowFormData: false });
              for (const issue of issues) serverToClientPropIssues.push({ ...issue, line: this.getLineOfPosition(sourceFile, attr.getStart(sourceFile)), target: tagInfo.targetRel });
            }
          }
        }
      }

      const exported = this.getExportedFunctionInfo(ts, sourceFile, node);
      if (exported?.isExported && exported.node) {
        const signature = checker.getSignatureFromDeclaration(exported.node);
        const returnType = signature ? checker.getReturnTypeOfSignature(signature) : null;
        const typeText = returnType ? checker.typeToString(returnType) : '';
        if (typeText === 'any' && this.strictish() && ['.ts', '.tsx'].includes(extname(sourceFile.fileName))) {
          exportedFunctionIssues.push({ functionName: exported.name, reason: 'exported function returns any', line: this.getLineOfPosition(sourceFile, exported.node.getStart(sourceFile)) });
        }
      }

      ts.forEachChild(node, visitSemantic);
    };

    visitSemantic(sourceFile);

    const typeNode = {
      rel,
      configRel,
      importedSymbols,
      typeOnlyImportValueViolations,
      typeImportOpportunities,
      clientComponentPropIssues,
      serverToClientPropIssues,
      serverActionSignatureIssues,
      exportedFunctionIssues,
    };

    if (astNode) astNode.typeInfo = typeNode;
    return typeNode;
  }

  getSymbolDeclarationRel(symbol) {
    const declarations = symbol?.declarations || [];
    for (const declaration of declarations) {
      const fileName = normalizeFileName(declaration.getSourceFile().fileName);
      if (fileName.startsWith(normalizeFileName(this.root)) && !fileName.includes('/node_modules/')) return this.rel(fileName);
    }
    return null;
  }

  getComponentDeclarationInfo(ts, checker, sourceFile, node) {
    if (ts.isFunctionDeclaration(node)) {
      const isExported = hasModifier(ts, node, 'export') || hasModifier(ts, node, 'default');
      const name = node.name?.getText(sourceFile) || (hasModifier(ts, node, 'default') ? 'default' : '<anonymous>');
      if (!this.isLikelyComponentName(name)) return null;
      return { isExported, name, firstParam: node.parameters?.[0] || null, node };
    }

    if (ts.isVariableStatement(node) && hasModifier(ts, node, 'export')) {
      for (const declaration of node.declarationList.declarations) {
        const name = declaration.name?.getText(sourceFile) || '<anonymous>';
        if (!this.isLikelyComponentName(name)) continue;
        const initializer = declaration.initializer;
        if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
          return { isExported: true, name, firstParam: initializer.parameters?.[0] || null, node: initializer };
        }
      }
    }

    if (ts.isExportAssignment(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression)) {
        const symbol = checker.getSymbolAtLocation(expression);
        const declarations = symbol?.declarations || [];
        for (const declaration of declarations) {
          if (ts.isFunctionDeclaration(declaration)) return { isExported: true, name: expression.getText(sourceFile), firstParam: declaration.parameters?.[0] || null, node: declaration };
          if (ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
            return { isExported: true, name: expression.getText(sourceFile), firstParam: declaration.initializer.parameters?.[0] || null, node: declaration.initializer };
          }
        }
      }
    }

    return null;
  }

  isLikelyComponentName(name) {
    return name === 'default' || /^[A-Z]/.test(name || '');
  }

  getExportedFunctionInfo(ts, sourceFile, node) {
    if (ts.isFunctionDeclaration(node)) {
      return { isExported: hasModifier(ts, node, 'export') || hasModifier(ts, node, 'default'), name: node.name?.getText(sourceFile) || 'default', params: [...node.parameters], node };
    }
    if (ts.isVariableStatement(node) && hasModifier(ts, node, 'export')) {
      for (const declaration of node.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
          return { isExported: true, name: declaration.name?.getText(sourceFile) || '<anonymous>', params: [...initializer.parameters], node: initializer };
        }
      }
    }
    return null;
  }

  getJsxImportedTagInfo(ts, checker, sourceFile, jsxNode, importLocals) {
    const tagName = jsxNode.tagName;
    if (!tagName || !ts.isIdentifier(tagName)) return null;
    const local = tagName.getText(sourceFile);
    const importInfo = importLocals.get(local);
    if (!importInfo) return null;

    let declarationRel = importInfo.declarationRel;
    try {
      const symbol = checker.getSymbolAtLocation(tagName);
      const aliased = symbol ? checker.getAliasedSymbol(symbol) : null;
      declarationRel = this.getSymbolDeclarationRel(aliased || symbol) || declarationRel;
    } catch {
      // Keep import-derived declaration.
    }

    return { local, targetRel: declarationRel || importInfo.resolvedRel, importInfo };
  }

  isTypeAwareClientComponentTarget(tagInfo) {
    const candidates = [tagInfo.targetRel, tagInfo.importInfo?.resolvedRel, tagInfo.importInfo?.declarationRel].filter(Boolean);
    for (const rel of candidates) {
      const node = this.astGraph.nodes.get(rel);
      if (node?.directives?.has('use client')) return true;
    }
    return false;
  }

  findNonSerializableTypeIssues(ts, checker, type, sourceNode, pathLabel, depth = 0, options = {}) {
    if (!type || depth > 7) return [];
    const issues = [];
    const typeText = checker.typeToString(type);
    const flags = type.flags || 0;

    if (pathLabel === 'props.children' && options.allowReactNodeChildren) return [];
    if (options.allowFormData && /\b(FormData|URLSearchParams)\b/.test(typeText)) return [];

    const unwrappedPromise = this.unwrapPromiseLikeType(ts, checker, type, typeText);
    if (unwrappedPromise) {
      if (options.allowPromise) {
        return this.findNonSerializableTypeIssues(ts, checker, unwrappedPromise, sourceNode, pathLabel, depth + 1, { ...options, allowPromise: false });
      }
      return [{ propPath: pathLabel, reason: 'Promise-like value is not serializable across this boundary', typeText }];
    }

    if (type.isUnion?.()) {
      for (const subType of type.types || []) {
        issues.push(...this.findNonSerializableTypeIssues(ts, checker, subType, sourceNode, pathLabel, depth + 1, options));
      }
      return dedupeSerializableIssues(issues);
    }

    if (type.isIntersection?.()) {
      for (const subType of type.types || []) {
        issues.push(...this.findNonSerializableTypeIssues(ts, checker, subType, sourceNode, pathLabel, depth + 1, options));
      }
      return dedupeSerializableIssues(issues);
    }

    if (this.isArrayLikeSerializableType(ts, checker, type, typeText)) {
      const elementTypes = this.getArrayElementTypes(ts, checker, type, sourceNode);
      for (const elementType of elementTypes) {
        issues.push(...this.findNonSerializableTypeIssues(ts, checker, elementType, sourceNode, `${pathLabel}[]`, depth + 1, options));
      }
      return dedupeSerializableIssues(issues);
    }

    if (isPrimitiveLikeType(ts, type)) return [];

    if (flags & ts.TypeFlags.Any) {
      return this.strictish() ? [{ propPath: pathLabel, reason: 'any hides whether the value is serializable', typeText: 'any' }] : [];
    }

    if (flags & ts.TypeFlags.Unknown) {
      return this.strictish() ? [{ propPath: pathLabel, reason: 'unknown hides whether the value is serializable', typeText: 'unknown' }] : [];
    }

    if (type.getCallSignatures?.().length > 0 || /\bFunction\b|Dispatch<|SetStateAction</.test(typeText)) {
      return [{ propPath: pathLabel, reason: 'function/callback type is not serializable across the server-to-client boundary', typeText }];
    }

    if (/^(PrismaClient|Decimal|Map<|ReadonlyMap<|Set<|ReadonlySet<|WeakMap<|WeakSet<|Symbol|Date|RegExp|Error|ReadableStream|WritableStream|Response|Request|Headers|AbortController|Blob|File)\b/.test(typeText)) {
      return [{ propPath: pathLabel, reason: 'platform/class instance type requires explicit serialization before crossing the boundary', typeText }];
    }

    const props = type.getProperties?.() || [];
    for (const prop of props.slice(0, 60)) {
      const propName = prop.getName();
      if (propName === 'children' && options.allowReactNodeChildren) continue;
      const declaration = prop.valueDeclaration || prop.declarations?.[0] || sourceNode;
      if (this.isPrototypeOrLibraryMember(declaration)) continue;
      if (declaration && (ts.isMethodDeclaration?.(declaration) || ts.isMethodSignature?.(declaration))) {
        issues.push({ propPath: `${pathLabel}.${propName}`, reason: 'method property is not serializable across the boundary', typeText: checker.typeToString(checker.getTypeOfSymbolAtLocation(prop, declaration)) });
        continue;
      }
      let propType;
      try {
        propType = checker.getTypeOfSymbolAtLocation(prop, declaration);
      } catch {
        continue;
      }
      issues.push(...this.findNonSerializableTypeIssues(ts, checker, propType, declaration, `${pathLabel}.${propName}`, depth + 1, options));
    }

    return dedupeSerializableIssues(issues);
  }

  unwrapPromiseLikeType(ts, checker, type, typeText) {
    if (!/^Promise(?:Like)?</.test(typeText)) return null;
    try {
      const typeArgs = checker.getTypeArguments?.(type) || type.typeArguments || [];
      if (typeArgs.length > 0) return typeArgs[0];
    } catch {
      // Fall through to apparent type inspection.
    }
    const thenable = type.getProperty?.('then');
    if (!thenable) return null;
    return null;
  }

  isArrayLikeSerializableType(ts, checker, type, typeText) {
    if (/^(readonly\s+)?[A-Za-z0-9_.$<>| &]+\[\]$/.test(typeText)) return true;
    if (/^(ReadonlyArray|Array)</.test(typeText)) return true;
    if (type.target && checker.typeToString(type.target).startsWith('Array')) return true;
    if (checker.isArrayType?.(type) || checker.isTupleType?.(type)) return true;
    return false;
  }

  getArrayElementTypes(ts, checker, type, sourceNode) {
    try {
      if (checker.isTupleType?.(type)) {
        const tupleArgs = checker.getTypeArguments?.(type) || [];
        if (tupleArgs.length > 0) return tupleArgs;
      }
      if (checker.isArrayType?.(type)) {
        const args = checker.getTypeArguments?.(type) || type.typeArguments || [];
        if (args.length > 0) return [args[0]];
      }
      const numberIndex = type.getNumberIndexType?.();
      if (numberIndex) return [numberIndex];
    } catch {
      // Use a safe fallback below.
    }
    return [];
  }

  isPrototypeOrLibraryMember(declaration) {
    if (!declaration?.getSourceFile) return false;
    const fileName = normalizeFileName(declaration.getSourceFile().fileName);
    return /\/node_modules\//.test(fileName) || /\/typescript\/lib\/lib\..*\.d\.ts$/.test(fileName) || /[\\/]lib\..*\.d\.ts$/.test(fileName);
  }

  auditTypeAwareGraph() {
    if (!this.typeGraph) return;

    for (const [rel, node] of this.typeGraph.nodes) {
      for (const info of node.typeOnlyImportValueViolations) {
        this.add({
          severity: 'critical',
          category: 'typescript',
          rule: 'type-only-import-used-as-value',
          file: rel,
          message: `Type-only import ${info.localName} from ${info.specifier} is used as a runtime value.`,
          fix: 'Convert this to a value import or remove the runtime usage. Type-only imports are erased from emitted JavaScript.',
          autofix: {
            kind: 'manual-codemod',
            confidence: 'high',
            title: 'Convert invalid import type usage to value import',
            targetFile: rel,
            steps: [`Change the import containing ${info.localName} from import type to a normal import if the runtime value is intentional.`, 'Otherwise move the usage into a type-only position.'],
          },
        });
      }

      for (const info of node.typeImportOpportunities) {
        this.add({
          severity: 'low',
          category: 'typescript',
          rule: 'value-import-used-only-as-type',
          file: rel,
          message: `Import ${info.localName} from ${info.specifier} is only used in type positions.`,
          fix: 'Change it to import type to remove accidental runtime edges and reduce client/server graph false positives.',
          autofix: {
            kind: 'safe-text-edit',
            confidence: 'medium',
            title: 'Convert value import to import type',
            targetFile: rel,
            line: info.line,
            steps: [`Rewrite ${info.localName} from ${info.specifier} as an import type binding, then run typecheck.`],
          },
        });
      }

      for (const issue of node.clientComponentPropIssues) {
        this.add({
          severity: issue.reason.includes('any') || issue.reason.includes('unknown') ? 'medium' : 'high',
          category: 'react',
          rule: 'client-component-nonserializable-prop-type',
          file: rel,
          message: `Client Component ${issue.componentName} exposes non-serializable prop ${issue.propPath} (${issue.typeText}): ${issue.reason}.`,
          fix: 'Keep Client Component entry props serializable. Move callbacks/stateful behavior inside the client leaf or pass a validated Server Action intentionally.',
          autofix: {
            kind: 'manual-codemod',
            confidence: 'medium',
            title: 'Make Client Component props serializable',
            targetFile: rel,
            line: issue.line,
            steps: ['Replace callback/class-instance props with primitive IDs or serializable DTOs.', 'Move event handlers into the Client Component leaf.', 'If this is an intentional Server Action prop, document the boundary and validate the action inputs.'],
          },
        });
      }

      for (const issue of node.serverToClientPropIssues) {
        this.add({
          severity: issue.reason.includes('function') ? 'critical' : 'high',
          category: 'react',
          rule: 'server-passes-nonserializable-prop-to-client-component',
          file: rel,
          message: `Server Component passes non-serializable prop ${issue.propPath} to Client Component ${issue.target || '<unknown>'} (${issue.typeText}): ${issue.reason}.`,
          fix: 'Pass serializable data only, move the behavior into the client leaf, or expose a validated Server Action explicitly.',
          autofix: {
            kind: 'manual-codemod',
            confidence: 'medium',
            title: 'Remove non-serializable server-to-client prop',
            targetFile: rel,
            relatedFiles: [issue.target].filter(Boolean),
            line: issue.line,
            steps: ['Replace the prop with primitive/JSON-safe data.', 'Move callbacks and browser state into the Client Component.', 'Use a Server Action only for mutations and validate the action boundary.'],
          },
        });
      }

      for (const issue of node.serverActionSignatureIssues) {
        this.add({
          severity: issue.reason.includes('any') || issue.reason.includes('unknown') ? 'medium' : 'high',
          category: 'security',
          rule: 'server-action-nonserializable-signature',
          file: rel,
          message: `Server Action ${issue.functionName} has risky ${issue.propPath} type (${issue.typeText}): ${issue.reason}.`,
          fix: 'Use explicit DTO/input schemas for Server Action parameters and return values. Keep implementation-only objects inside the action body.',
          autofix: {
            kind: 'manual-codemod',
            confidence: 'medium',
            title: 'Harden Server Action signature',
            targetFile: rel,
            line: issue.line,
            steps: ['Define a zod/valibot schema for the action input.', 'Return a serializable result union such as { ok: true, data } | { ok: false, fieldErrors }.', 'Avoid returning database clients, Request/Response objects, streams, or class instances.'],
          },
        });
      }

      for (const issue of node.exportedFunctionIssues) {
        this.add({
          severity: 'low',
          category: 'typescript',
          rule: 'exported-function-returns-any',
          file: rel,
          message: `Exported function ${issue.functionName} returns any.`,
          fix: 'Add an explicit return type and remove unsafe any propagation from public module boundaries.',
        });
      }
    }

    if (this.typeGraph.diagnostics.length > 0 && this.strictish()) {
      for (const diagnostic of this.typeGraph.diagnostics.slice(0, 20)) {
        this.add({
          severity: 'medium',
          category: 'typescript',
          rule: 'semantic-diagnostic-detected',
          file: diagnostic.file,
          message: `TypeScript semantic diagnostic ${diagnostic.code}: ${diagnostic.message}`,
          fix: 'Run tsc --noEmit in the owning package and resolve semantic errors before relying on deployment builds.',
        });
      }
    }
  }


  auditDependencyManifests() {
    if (!this.astGraph) return;
    const workspaceNames = new Map();
    for (const pkg of this.packageIndex) {
      if (pkg.json?.name) workspaceNames.set(pkg.json.name, pkg);
    }

    const allowedRootTooling = new Set(['typescript', 'eslint', 'prettier', 'turbo', 'tsx', 'vitest', 'jest', 'playwright']);

    for (const node of this.astGraph.nodes.values()) {
      const owner = this.getOwningPackage(node.file);
      if (!owner?.json) continue;
      const rootOwner = owner.rel === 'package.json';
      const declared = owner.deps || {};
      const rootPackage = this.packageIndex.find((pkg) => pkg.rel === 'package.json');
      const rootDeclared = rootPackage?.deps || {};

      for (const imported of node.imports) {
        if (imported.typeOnly || imported.resolvedRel || isBuiltinSpecifier(imported.specifier) || imported.specifier.startsWith('.') || imported.specifier.startsWith('/')) continue;
        const packageName = getPackageSpecifierName(imported.specifier);
        if (!packageName) continue;
        if (packageName === owner.json.name) continue;
        if (declared[packageName]) continue;
        if (rootOwner && rootDeclared[packageName]) continue;
        if (!rootOwner && rootDeclared[packageName] && allowedRootTooling.has(packageName)) continue;

        this.add({
          severity: this.isRuntimeImportKind(imported.kind) ? 'medium' : 'low',
          category: 'package',
          rule: 'external-import-not-declared-in-package',
          file: node.rel,
          message: `${owner.json.name || owner.rel} imports ${packageName} but does not declare it in its package manifest.`,
          fix: `Add ${packageName} to the owning package's dependencies/devDependencies, or move the import to a package that already owns that dependency.`,
          autofix: {
            kind: 'package-manager',
            confidence: 'medium',
            title: 'Declare missing package dependency',
            targetFile: owner.rel,
            commands: [`bun add ${packageName} --filter ${owner.json.name || './' + dirname(owner.rel)}`],
          },
        });
      }

      for (const imported of node.imports) {
        if (imported.typeOnly || !imported.specifier || imported.specifier.startsWith('.') || imported.specifier.startsWith('/')) continue;
        const packageName = getPackageSpecifierName(imported.specifier);
        const targetWorkspace = workspaceNames.get(packageName);
        if (!targetWorkspace || targetWorkspace === owner || declared[packageName]) continue;
        this.add({
          severity: 'high',
          category: 'package',
          rule: 'workspace-import-not-declared',
          file: node.rel,
          message: `${owner.json.name || owner.rel} imports workspace package ${packageName} without declaring it as a dependency.`,
          fix: `Add "${packageName}": "workspace:*" to the owning package dependencies to make Turbo's package graph deterministic.`,
          autofix: {
            kind: 'package-json-edit',
            confidence: 'medium',
            title: 'Declare workspace dependency',
            targetFile: owner.rel,
            steps: [`Add ${packageName} to dependencies with version workspace:*`, 'Run the package manager install command and rerun turbo graph/audit.'],
          },
        });
      }
    }
  }

  auditNextRouteRuntimeGraph() {
    if (!this.astGraph) return;
    for (const node of this.astGraph.nodes.values()) {
      if (!/(^|\/)app\/.*\/(page|layout|route)\.(ts|tsx|js|jsx)$/.test(node.rel) && !/(^|\/)middleware\.(ts|js)$/.test(node.rel)) continue;
      const content = this.readFile(node.file);
      const runtime = readExportedConstString(content, 'runtime');
      const dynamic = readExportedConstString(content, 'dynamic');
      const fetchCache = readExportedConstString(content, 'fetchCache');
      const revalidate = readExportedConstLiteral(content, 'revalidate');

      if (runtime === 'edge') {
        const chain = this.findImportChain(node.rel, (candidate) => candidate.rel !== node.rel && this.isNodeRuntimeOnlyNode(candidate), 40);
        if (chain) {
          this.add({
            severity: 'critical',
            category: 'next',
            rule: 'edge-runtime-transitively-imports-node-code',
            file: node.rel,
            message: `Route segment declares runtime="edge" but its import graph reaches Node/database-only code: ${chain.join(' -> ')}.`,
            fix: 'Move Node-only/database work behind a Node runtime route/action, use an edge-compatible adapter, or change this segment to runtime="nodejs".',
            autofix: {
              kind: 'manual-codemod',
              confidence: 'medium',
              title: 'Fix edge runtime graph contamination',
              targetFile: node.rel,
              relatedFiles: chain,
              steps: ['Remove Node built-ins and standard Prisma/DB clients from the edge graph.', 'Use fetch-based services or edge-compatible adapters only.', 'Otherwise change the route segment runtime to nodejs and verify latency separately.'],
            },
          });
        }
      }

      if (dynamic === 'force-dynamic' && /cacheTag\(|cacheLife\(|['"]use cache['"]/.test(content)) {
        this.add({
          severity: 'medium',
          category: 'next',
          rule: 'mixed-force-dynamic-cache-policy',
          file: node.rel,
          message: 'Route segment mixes force-dynamic with explicit cache directives/functions. The caching policy is likely unclear.',
          fix: 'Choose a single policy: dynamic request-time rendering or explicit cacheComponents/use-cache boundaries.',
        });
      }

      if ((fetchCache === 'force-no-store' || revalidate === '0') && /cacheTag\(|cacheLife\(|['"]use cache['"]/.test(content)) {
        this.add({
          severity: 'medium',
          category: 'next',
          rule: 'mixed-no-store-cache-policy',
          file: node.rel,
          message: 'Route segment opts out of caching while also using explicit cache APIs.',
          fix: 'Remove no-store settings for cacheable data or remove cache APIs from request-specific code.',
        });
      }
    }
  }

  auditServerClientMarkers() {
    if (!this.astGraph) return;
    for (const node of this.astGraph.nodes.values()) {
      if (/(^|\/)(bin|scripts|tools)\//.test(node.rel) || /(^|\/)(next|turbo|prisma|tailwind|postcss|eslint|vitest|playwright)\.config\./.test(node.rel)) continue;
      const isFrameworkServerEntry = this.isHardServerRuntimeRoot(node) || /(^|\/)app\/.*\/(page|layout)\.(ts|tsx|js|jsx)$/.test(node.rel);
      if (!isFrameworkServerEntry && this.isServerTaintedNode(node) && !node.externalImports.has('server-only') && !node.directives.has('use server')) {
        this.add({
          severity: 'low',
          category: 'architecture',
          rule: 'server-module-missing-server-only-marker',
          file: node.rel,
          message: 'Server-tainted module does not import server-only. Accidental client imports may not fail fast enough.',
          fix: 'Add `import "server-only";` to server-only utility modules, especially database/auth/payment/env modules.',
          autofix: {
            kind: 'safe-text-edit',
            confidence: 'medium',
            title: 'Add server-only marker',
            targetFile: node.rel,
            steps: ['Insert import "server-only"; at the top of the module and rerun the auditor.'],
          },
        });
      }

      if (!node.directives.has('use client') && node.usesBrowserApi && !node.externalImports.has('client-only')) {
        this.add({
          severity: 'medium',
          category: 'architecture',
          rule: 'browser-module-missing-client-boundary',
          file: node.rel,
          message: 'Module uses browser APIs but is not explicitly marked as a Client Component/client-only module.',
          fix: 'Move browser API usage into a leaf Client Component or add an explicit client-only boundary for non-component browser utilities.',
        });
      }
    }
  }

  isNodeRuntimeOnlyNode(node) {
    if (!node) return false;
    if (node.serverOnlyImports.size === 0) return false;
    for (const specifier of node.serverOnlyImports) {
      if (NODE_EDGE_RISK_IMPORTS.includes(specifier) || isBuiltinSpecifier(specifier)) return true;
    }
    return /(^|\/)(db|database|prisma|server|stripe|payments)(\/|\.)/.test(node.rel);
  }

  getOwningPackage(file) {
    const normalized = normalizeFileName(file);
    let best = null;
    for (const pkg of this.packageIndex) {
      const dir = normalizeFileName(pkg.dir);
      if (normalized === dir || normalized.startsWith(`${dir}/`)) {
        if (!best || dir.length > normalizeFileName(best.dir).length) best = pkg;
      }
    }
    return best;
  }

  isRuntimeImportKind(kind) {
    return kind === 'static' || kind === 'require' || kind === 'dynamic' || kind === 'export';
  }

  buildBudgetReport() {
    if (!this.astGraph) return null;
    const clientEntries = [...this.astGraph.nodes.values()].filter((node) => node.directives.has('use client'));
    const entries = [];
    for (const entry of clientEntries) {
      const reachable = [...this.collectReachableRuntimeNodes(entry.rel, 40)];
      let lines = 0;
      const externalImports = new Set();
      const heavyImports = new Set();
      const serverTainted = [];
      for (const rel of reachable) {
        const node = this.astGraph.nodes.get(rel);
        if (!node) continue;
        lines += node.lineCount || 0;
        for (const specifier of node.externalImports) externalImports.add(getPackageSpecifierName(specifier) || specifier);
        for (const specifier of node.heavyClientImports) heavyImports.add(specifier);
        if (this.isServerTaintedNode(node)) serverTainted.push(rel);
      }
      entries.push({ entry: entry.rel, moduleCount: reachable.length, lineCount: lines, externalImports: [...externalImports].sort(), heavyImports: [...heavyImports].sort(), serverTainted });
    }
    entries.sort((a, b) => b.moduleCount - a.moduleCount || b.lineCount - a.lineCount);
    return { version: VERSION, generatedAt: new Date().toISOString(), root: this.root, clientEntries: entries };
  }
  auditWorkspaceShape() {
    const rootPackage = this.readJson('package.json');
    if (!rootPackage) {
      this.add({
        severity: 'critical',
        category: 'repository',
        rule: 'missing-root-package-json',
        file: 'package.json',
        message: 'Missing root package.json. Workspace package discovery and scripts cannot be audited reliably.',
        fix: 'Add a root package.json with workspaces and packageManager configured.',
      });
      return;
    }

    if (!rootPackage.private) {
      this.add({
        severity: 'medium',
        category: 'repository',
        rule: 'root-not-private',
        file: 'package.json',
        message: 'Root package.json is not private. Monorepo roots should normally be private to prevent accidental publication.',
        fix: 'Set "private": true in the root package.json.',
      });
    }

    if (!rootPackage.workspaces && !existsSync(join(this.root, 'pnpm-workspace.yaml'))) {
      this.add({
        severity: 'high',
        category: 'repository',
        rule: 'workspace-not-declared',
        file: 'package.json',
        message: 'No workspaces field or pnpm-workspace.yaml detected. Turborepo may not discover packages correctly.',
        fix: 'Declare workspace packages explicitly, for example apps/* and packages/*.',
      });
    }

    const appsDir = join(this.root, 'apps');
    if (!existsSync(appsDir)) {
      this.add({
        severity: 'medium',
        category: 'repository',
        rule: 'missing-apps-directory',
        message: 'No apps/ directory found. This is acceptable only for an intentionally custom workspace layout.',
        fix: 'Prefer apps/* for deployable apps and packages/* for libraries, or document the custom layout.',
      });
    }

    const packagesDir = join(this.root, 'packages');
    if (!existsSync(packagesDir)) {
      this.add({
        severity: 'low',
        category: 'repository',
        rule: 'missing-packages-directory',
        message: 'No packages/ directory found. Shared libraries may be mixed into apps or a custom layout.',
        fix: 'Prefer packages/* for reusable code, configs, UI libraries, and tooling packages.',
      });
    }
  }

  auditPackageManager() {
    const rootPackage = this.readJson('package.json') || {};
    if (!rootPackage.packageManager) {
      this.add({
        severity: 'medium',
        category: 'repository',
        rule: 'missing-package-manager',
        file: 'package.json',
        message: 'Root package.json does not pin packageManager. Installs may differ across machines and CI.',
        fix: 'Set packageManager, for example "bun@1.2.x" or "pnpm@10.x".',
      });
    }
  }

  auditPackageVersions() {
    const rootPackage = this.readJson('package.json') || {};
    const rootDeps = getAllDeps(rootPackage);
    const allDeps = mergePackageDeps(this.packageIndex.map((entry) => entry.deps));

    const next = allDeps.next;
    const react = allDeps.react;
    const reactDom = allDeps['react-dom'];
    const turbo = allDeps.turbo || rootDeps.turbo;
    const prisma = allDeps.prisma;
    const prismaClient = allDeps['@prisma/client'];
    const typescript = allDeps.typescript;

    if (next && parseMajor(next) < 16) {
      this.add({
        severity: this.strictish() ? 'high' : 'medium',
        category: 'dependencies',
        rule: 'next-version-below-target',
        file: 'package.json',
        message: `Next.js target is 16+, but detected ${next}.`,
        fix: 'Upgrade intentionally, run the Next 16 codemods, and re-run this auditor in CI.',
      });
    }

    if (react && parseMajor(react) < 19) {
      this.add({
        severity: this.strictish() ? 'high' : 'medium',
        category: 'dependencies',
        rule: 'react-version-below-target',
        file: 'package.json',
        message: `React target is 19+, but detected ${react}.`,
        fix: 'Upgrade React and React DOM together and audit all client boundaries.',
      });
    }

    if (react && reactDom && parseMajor(react) !== parseMajor(reactDom)) {
      this.add({
        severity: 'critical',
        category: 'dependencies',
        rule: 'react-react-dom-major-mismatch',
        file: 'package.json',
        message: `react (${react}) and react-dom (${reactDom}) major versions do not match.`,
        fix: 'Pin react and react-dom to the same major and preferably the same release range.',
      });
    }

    if (turbo && parseMajor(turbo) < 2) {
      this.add({
        severity: 'high',
        category: 'dependencies',
        rule: 'turbo-version-below-target',
        file: 'package.json',
        message: `Turborepo target is 2+, but detected ${turbo}.`,
        fix: 'Upgrade turbo and migrate turbo.json to the current tasks format.',
      });
    }

    if (prisma && parseMajor(prisma) < 7) {
      this.add({
        severity: this.strictish() ? 'high' : 'medium',
        category: 'dependencies',
        rule: 'prisma-version-below-target',
        file: 'package.json',
        message: `Prisma target is 7+, but detected prisma ${prisma}.`,
        fix: 'Upgrade with the Prisma 7 guide, add prisma.config.ts, and verify driver adapter behavior.',
      });
    }

    if (prisma && prismaClient && parseMajor(prisma) !== parseMajor(prismaClient)) {
      this.add({
        severity: 'critical',
        category: 'dependencies',
        rule: 'prisma-cli-client-major-mismatch',
        file: 'package.json',
        message: `prisma (${prisma}) and @prisma/client (${prismaClient}) major versions do not match.`,
        fix: 'Keep prisma and @prisma/client on the same major version.',
      });
    }

    if (typescript && parseMajor(typescript) < 5) {
      this.add({
        severity: 'medium',
        category: 'dependencies',
        rule: 'typescript-version-old',
        file: 'package.json',
        message: `TypeScript appears old (${typescript}) for a modern Next/React monorepo.`,
        fix: 'Upgrade TypeScript and rerun typecheck across all workspaces.',
      });
    }

    const hasRouteOrServerAction = this.files.some((file) => {
      const rel = this.rel(file);
      if (!SOURCE_EXTENSIONS.has(extname(file))) return false;
      const content = this.readFile(file);
      return /\/route\.(ts|js)$/.test(rel) || hasUseDirective(content, 'server');
    });
    if (hasRouteOrServerAction && !hasAnyDep(allDeps, ['zod', 'valibot', 'arktype', 'yup'])) {
      this.add({
        severity: 'medium',
        category: 'quality',
        rule: 'missing-validation-library',
        file: 'package.json',
        message: 'Server Actions or route handlers are present, but no common validation library was detected.',
        fix: 'Install and standardize on zod, valibot, or arktype for every action/handler boundary.',
      });
    }

    if (this.hasNextDependency() && !hasAnyDep(allDeps, ['@next/bundle-analyzer'])) {
      this.add({
        severity: 'info',
        category: 'developer-experience',
        rule: 'bundle-analyzer-not-installed',
        file: 'package.json',
        message: '@next/bundle-analyzer is not installed. This is optional but useful for client-bundle regressions.',
        fix: 'Add an analyze script that runs the official Next bundle analyzer on demand.',
      });
    }
  }

  auditTurborepoConfig() {
    const turboPath = join(this.root, 'turbo.json');
    if (!existsSync(turboPath)) {
      this.add({
        severity: 'high',
        category: 'turborepo',
        rule: 'missing-turbo-json',
        file: 'turbo.json',
        message: 'Missing turbo.json. CI cannot enforce build, lint, test, typecheck, and audit tasks consistently.',
        fix: 'Add a root turbo.json with tasks for build, dev, lint, typecheck, test, and audit:performance.',
      });
      return;
    }

    const raw = this.readFile(turboPath);
    const turbo = this.parseJson(raw, 'turbo.json');
    if (!turbo) return;

    if (Object.hasOwn(turbo, 'pipeline')) {
      this.add({
        severity: 'critical',
        category: 'turborepo',
        rule: 'turbo-pipeline-key',
        file: 'turbo.json',
        message: 'turbo.json uses the stale pipeline key. Current Turborepo config uses tasks.',
        fix: 'Rename pipeline to tasks and verify task outputs/env/input declarations.',
      });
    }

    const tasks = turbo.tasks || turbo.pipeline || {};
    const requiredTasks = ['build', 'lint', 'typecheck', 'test'];
    for (const task of requiredTasks) {
      if (!tasks[task]) {
        this.add({
          severity: task === 'build' ? 'high' : 'medium',
          category: 'turborepo',
          rule: `missing-${task}-task`,
          file: 'turbo.json',
          message: `No ${task} task configured in turbo.json.`,
          fix: `Add tasks.${task} and wire it into CI.` ,
        });
      }
    }

    if (!tasks['audit:performance'] && !tasks.audit) {
      this.add({
        severity: 'medium',
        category: 'turborepo',
        rule: 'missing-audit-task',
        file: 'turbo.json',
        message: 'No performance audit task is registered in Turborepo.',
        fix: 'Add tasks["audit:performance"] with outputs: [] and run it before build in CI.',
      });
    }

    if (tasks.build) {
      const outputs = Array.isArray(tasks.build.outputs) ? tasks.build.outputs : [];
      if (!outputs.some((value) => String(value).includes('.next/**'))) {
        this.add({
          severity: 'medium',
          category: 'turborepo',
          rule: 'build-outputs-missing-next',
          file: 'turbo.json',
          message: 'Build task outputs do not include .next/**. Next.js build cache artifacts may not be captured.',
          fix: 'Add ".next/**" and "!.next/cache/**" to tasks.build.outputs for Next apps.',
        });
      }

      const buildEnv = Array.isArray(tasks.build.env) ? tasks.build.env : [];
      const globalEnv = Array.isArray(turbo.globalEnv) ? turbo.globalEnv : [];
      const combinedEnv = new Set([...buildEnv, ...globalEnv]);
      if (!hasEnv(combinedEnv, 'DATABASE_URL') && this.files.some((file) => file.endsWith('schema.prisma'))) {
        this.add({
          severity: 'medium',
          category: 'turborepo',
          rule: 'database-url-not-hashed',
          file: 'turbo.json',
          message: 'DATABASE_URL is not declared in build env/globalEnv while Prisma is present. Build cache may ignore database/provider changes.',
          fix: 'Add DATABASE_URL to tasks.build.env or document why generated Prisma output is independent of it.',
        });
      }
    }

    if (tasks.dev && tasks.dev.cache !== false) {
      this.add({
        severity: 'medium',
        category: 'turborepo',
        rule: 'dev-task-cache-enabled',
        file: 'turbo.json',
        message: 'The dev task is cacheable. Long-running development servers should not be cached.',
        fix: 'Set tasks.dev.cache to false and persistent to true.',
      });
    }

    if (tasks.dev && tasks.dev.persistent !== true) {
      this.add({
        severity: 'low',
        category: 'turborepo',
        rule: 'dev-task-not-persistent',
        file: 'turbo.json',
        message: 'The dev task is not marked persistent.',
        fix: 'Set tasks.dev.persistent to true for long-running servers.',
      });
    }

    if (tasks.dev?.persistent === true && tasks.dev?.interruptible !== true) {
      this.add({
        severity: 'info',
        category: 'turborepo',
        rule: 'dev-task-not-interruptible',
        file: 'turbo.json',
        message: 'Persistent dev task is not marked interruptible. turbo watch will not restart it automatically.',
        fix: 'Consider tasks.dev.interruptible: true if you use turbo watch.',
      });
    }

    if (!turbo.boundaries && this.strictish()) {
      this.add({
        severity: 'low',
        category: 'turborepo',
        rule: 'turbo-boundaries-not-configured',
        file: 'turbo.json',
        message: 'Turbo boundaries are not configured. Package dependency rules cannot be enforced by turbo boundaries.',
        fix: 'Add tags and dependency deny/allow rules for app, ui, data, config, server-only, and client-safe packages.',
      });
    }
  }

  auditTsConfig() {
    const tsconfigs = this.files.filter((file) => basename(file) === 'tsconfig.json');
    if (this.hasNextDependency() && tsconfigs.length === 0) {
      this.add({
        severity: 'high',
        category: 'typescript',
        rule: 'missing-tsconfig',
        file: 'tsconfig.json',
        message: 'Next.js dependency detected, but no tsconfig.json was found.',
        fix: 'Add a strict TypeScript config and run typecheck in CI.',
      });
      return;
    }

    for (const file of tsconfigs) {
      const rel = this.rel(file);
      const json = this.readJson(rel);
      if (!json) continue;
      const options = json.compilerOptions || {};
      if (options.strict !== true) {
        this.add({
          severity: 'high',
          category: 'typescript',
          rule: 'strict-mode-disabled',
          file: rel,
          message: 'TypeScript strict mode is not enabled.',
          fix: 'Set compilerOptions.strict to true and fix the resulting type gaps intentionally.',
        });
      }
      if (this.strictish() && options.noUncheckedIndexedAccess !== true) {
        this.add({
          severity: 'low',
          category: 'typescript',
          rule: 'no-unchecked-indexed-access-disabled',
          file: rel,
          message: 'noUncheckedIndexedAccess is not enabled. Array/object lookups can hide undefined paths.',
          fix: 'Enable noUncheckedIndexedAccess in shared strict configs, then fix surfaced errors.',
        });
      }
      if (this.strictish() && options.exactOptionalPropertyTypes !== true) {
        this.add({
          severity: 'low',
          category: 'typescript',
          rule: 'exact-optional-property-types-disabled',
          file: rel,
          message: 'exactOptionalPropertyTypes is not enabled.',
          fix: 'Enable exactOptionalPropertyTypes for cleaner domain and API models.',
        });
      }
    }
  }

  auditNextConfigs() {
    const nextConfigs = this.files.filter((file) => NEXT_CONFIG_FILES.includes(basename(file)));

    if (nextConfigs.length === 0 && this.hasNextDependency()) {
      this.add({
        severity: 'medium',
        category: 'next',
        rule: 'missing-next-config',
        message: 'Next.js dependency detected, but no next.config.* file was found.',
        fix: 'Add next.config.ts/js/mjs and explicitly configure cache, image, typed routes, headers, and analyzer policy.',
      });
      return;
    }

    for (const file of nextConfigs) {
      const rel = this.rel(file);
      const content = this.readFile(file);
      const usesHyperdriveWrapper = /withHyperdrive\s*\(/.test(content);
      const nextMajor = this.detectNextVersionMajorForFile(file);
      const reactMajor = this.detectReactVersionMajor();
      const allDeps = mergePackageDeps(this.packageIndex.map((entry) => entry.deps));

      if (/\bswcMinify\s*:/.test(content)) {
        this.add({
          severity: 'critical',
          category: 'next',
          rule: 'stale-swc-minify',
          file: rel,
          message: 'next.config contains swcMinify. This is stale config-era advice and should not be used as a current performance control.',
          fix: 'Remove swcMinify. Rely on framework defaults for your installed Next.js version.',
        });
      }

      if (/\bturboMode\s*:/.test(content)) {
        this.add({
          severity: 'critical',
          category: 'next',
          rule: 'invalid-turbo-mode',
          file: rel,
          message: 'next.config contains turboMode. This is not a valid modern Next.js config option.',
          fix: 'Remove turboMode. Use next dev --turbo or documented turbopack config where needed.',
        });
      }

      if (/experimental\s*:\s*{[\s\S]{0,500}\btypedRoutes\s*:/.test(content)) {
        this.add({
          severity: 'high',
          category: 'next',
          rule: 'experimental-typed-routes',
          file: rel,
          message: 'typedRoutes is configured under experimental. In modern Next.js it is stable at the top level.',
          fix: 'Move experimental.typedRoutes to typedRoutes: true.',
        });
      }

      if (/serverComponentsExternalPackages\s*:/.test(content)) {
        this.add({
          severity: 'high',
          category: 'next',
          rule: 'stale-server-components-external-packages',
          file: rel,
          message: 'serverComponentsExternalPackages has been renamed to serverExternalPackages.',
          fix: 'Use serverExternalPackages.',
        });
      }

      if (/experimental_ppr\s*:|ppr\s*:/.test(content) && nextMajor >= 16) {
        this.add({
          severity: 'high',
          category: 'next',
          rule: 'legacy-ppr-config',
          file: rel,
          message: 'Legacy PPR config is present in a Next 16+ app.',
          fix: 'Use cacheComponents: true and explicit use cache/cacheLife/cacheTag boundaries instead.',
        });
      }

      if (/optimizeCss\s*:/.test(content)) {
        this.add({
          severity: 'medium',
          category: 'next',
          rule: 'optimize-css-risk',
          file: rel,
          message: 'optimizeCss is present. Treat it as a compatibility risk unless pinned to a verified Next.js version and CSS pipeline.',
          fix: 'Prefer current documented CSS options such as inlineCss/cssChunking where applicable, and verify production builds.',
        });
      }

      if (/Link\s*['"]?\s*,?\s*value\s*:\s*['"][^'"]*\/_next\/static/i.test(content)) {
        this.add({
          severity: 'high',
          category: 'next',
          rule: 'blanket-next-static-preload',
          file: rel,
          message: 'Config appears to emit a blanket Link preload header for /_next/static. This can over-fetch or preload a directory instead of precise assets.',
          fix: 'Remove blanket preload headers. Let Next.js emit route-specific hints and use Link/router prefetch for navigation.',
        });
      }

      if (/images\s*:\s*{[\s\S]{0,1000}\bdomains\s*:/.test(content)) {
        this.add({
          severity: 'medium',
          category: 'next',
          rule: 'image-domains-instead-of-remote-patterns',
          file: rel,
          message: 'images.domains is present. remotePatterns gives stricter protocol/hostname/path/search controls.',
          fix: 'Migrate remote images to images.remotePatterns.',
        });
      }

      if (/dangerouslyAllowSVG\s*:\s*true/.test(content) && !/contentSecurityPolicy\s*:/.test(content)) {
        this.add({
          severity: 'critical',
          category: 'security',
          rule: 'svg-optimization-without-csp',
          file: rel,
          message: 'images.dangerouslyAllowSVG is enabled without an obvious image contentSecurityPolicy.',
          fix: 'Disable SVG optimization or add a restrictive images.contentSecurityPolicy and contentDispositionType.',
        });
      }

      if (/dangerouslyAllowLocalIP\s*:\s*true/.test(content)) {
        this.add({
          severity: 'critical',
          category: 'security',
          rule: 'image-local-ip-enabled',
          file: rel,
          message: 'images.dangerouslyAllowLocalIP is enabled. This can expose internal network targets via image optimization.',
          fix: 'Set dangerouslyAllowLocalIP to false unless this is a tightly controlled internal deployment.',
        });
      }

      if (!usesHyperdriveWrapper && (!/images\s*:/.test(content) || !/formats\s*:/.test(content))) {
        this.add({
          severity: 'medium',
          category: 'next',
          rule: 'missing-image-formats',
          file: rel,
          message: 'No explicit Next image formats configuration found.',
          fix: "Add images.formats: ['image/avif', 'image/webp'] after testing encode cost and CDN Accept-header forwarding.",
        });
      }

      if (!usesHyperdriveWrapper && !/poweredByHeader\s*:\s*false/.test(content)) {
        this.add({
          severity: 'low',
          category: 'next',
          rule: 'powered-by-header-enabled',
          file: rel,
          message: 'poweredByHeader is not explicitly disabled.',
          fix: 'Set poweredByHeader: false in next.config.',
        });
      }

      if (!usesHyperdriveWrapper && !/headers\s*\(/.test(content) && !/headers\s*:\s*async/.test(content)) {
        this.add({
          severity: 'low',
          category: 'security',
          rule: 'missing-security-headers',
          file: rel,
          message: 'No custom headers() policy detected in next.config.',
          fix: 'Add reviewed headers for content sniffing, referrer policy, COOP, CSP, and permissions policy as appropriate.',
        });
      }

      if (reactMajor >= 19) {
        const hasReactCompiler = /reactCompiler\s*:/.test(content);
        if (hasReactCompiler && !allDeps['babel-plugin-react-compiler']) {
          this.add({
            severity: 'high',
            category: 'react',
            rule: 'react-compiler-plugin-missing',
            file: rel,
            message: 'reactCompiler is enabled but babel-plugin-react-compiler is not installed.',
            fix: 'Install babel-plugin-react-compiler as a devDependency or disable reactCompiler.',
          });
        }
        if (!hasReactCompiler && this.strictish()) {
          this.add({
            severity: 'medium',
            category: 'react',
            rule: 'react-compiler-not-declared',
            file: rel,
            message: 'React 19 is detected but reactCompiler is not declared in Next config.',
            fix: 'Evaluate reactCompiler: true or annotation mode in a measured branch.',
          });
        }
      }

      if (nextMajor >= 16 && !/cacheComponents\s*:/.test(content) && this.strictish()) {
        this.add({
          severity: 'medium',
          category: 'next',
          rule: 'cache-components-not-declared',
          file: rel,
          message: 'Next 16+ app does not declare cacheComponents. That may be intentional, but caching policy is not explicit.',
          fix: 'Adopt cacheComponents: true only after auditing dynamic data paths and adding use cache/cacheLife/cacheTag where appropriate.',
        });
      }

      if (!usesHyperdriveWrapper && !/typedRoutes\s*:/.test(content) && this.usesTypeScript()) {
        this.add({
          severity: 'low',
          category: 'developer-experience',
          rule: 'typed-routes-disabled',
          file: rel,
          message: 'typedRoutes is not enabled in a TypeScript Next app.',
          fix: 'Set typedRoutes: true to catch invalid internal links at compile time.',
        });
      }

      if (/webpack\s*\(/.test(content) || /webpack\s*:/.test(content)) {
        this.add({
          severity: 'info',
          category: 'next',
          rule: 'custom-webpack-config',
          file: rel,
          message: 'Custom webpack config detected. This may limit Turbopack parity or hide bundling regressions.',
          fix: 'Keep custom webpack minimal, document why it exists, and verify next dev --turbo/build behavior.',
        });
      }
    }
  }

  auditPackageScripts() {
    const packageFiles = this.files.filter((file) => basename(file) === 'package.json');
    for (const file of packageFiles) {
      const rel = this.rel(file);
      const json = this.readJson(rel);
      if (!json) continue;

      const deps = getDirectDeps(json);
      const hasNext = Boolean(deps.next);
      const scripts = json.scripts || {};

      if (hasNext) {
        if (!scripts.typecheck && !scripts['type-check']) {
          this.add({
            severity: 'medium',
            category: 'quality',
            rule: 'missing-typecheck-script',
            file: rel,
            message: 'Next app package is missing a typecheck script.',
            fix: 'Add "typecheck": "tsc --noEmit" and wire it into Turborepo/CI.',
          });
        }

        if (!scripts.lint) {
          this.add({
            severity: 'medium',
            category: 'quality',
            rule: 'missing-lint-script',
            file: rel,
            message: 'Next app package is missing a lint script.',
            fix: 'Add a lint script and wire it into Turborepo/CI.',
          });
        }

        if (!scripts.build) {
          this.add({
            severity: 'high',
            category: 'quality',
            rule: 'missing-build-script',
            file: rel,
            message: 'Next app package is missing a build script.',
            fix: 'Add "build": "next build".',
          });
        }

        if (scripts.dev && !String(scripts.dev).includes('--turbo') && this.detectNextVersionMajor(deps.next) >= 15) {
          this.add({
            severity: 'low',
            category: 'next',
            rule: 'dev-script-not-turbo',
            file: rel,
            message: 'Next dev script does not opt into Turbopack.',
            fix: 'Use "next dev --turbo" after confirming plugins and custom config are compatible.',
          });
        }
      }

      if ((rel === 'package.json' || hasNext) && !scripts.test && this.strictish()) {
        this.add({
          severity: 'low',
          category: 'quality',
          rule: 'missing-test-script',
          file: rel,
          message: 'No test script found.',
          fix: 'Add unit/integration tests with Vitest/Jest and a separate e2e script where applicable.',
        });
      }

      if ((rel === 'package.json' || hasNext) && !scripts.format && !scripts['format:check']) {
        this.add({
          severity: 'info',
          category: 'developer-experience',
          rule: 'missing-format-script',
          file: rel,
          message: 'No format or format:check script found.',
          fix: 'Add a repo-standard formatter check to keep diffs predictable.',
        });
      }
    }
  }

  auditSourceFiles() {
    const sourceFiles = this.files.filter((file) => SOURCE_EXTENSIONS.has(extname(file)));
    for (const file of sourceFiles) {
      const content = this.readFile(file);
      const rel = this.rel(file);
      const isClient = hasUseDirective(content, 'client');
      const isServer = hasUseDirective(content, 'server');
      const isRouteHandler = /\/route\.(ts|js)$/.test(rel);
      const isPageOrLayout = /\/(page|layout)\.(tsx|jsx|ts|js|mdx)$/.test(rel);
      const isAppFile = /(^|\/)app\//.test(rel) && APP_SOURCE_EXTENSIONS.has(extname(file));

      if (isClient) this.auditClientComponent(content, rel);
      if (!isClient) this.auditServerOrSharedSource(content, rel);
      if (isServer) this.auditServerActionFile(content, rel);
      if (isRouteHandler) this.auditRouteHandler(content, rel);
      if (isPageOrLayout) this.auditPageOrLayout(content, rel);
      if (isAppFile) this.auditAppFile(content, rel);
      this.auditGeneralSource(content, rel);
    }
  }

  auditClientComponent(content, rel) {
    const hasInteractivity = /\b(useState|useReducer|useEffect|useLayoutEffect|useRef|useImperativeHandle|useTransition|useOptimistic|useActionState|useFormStatus|useFormState|useRouter|usePathname|useSearchParams)\b|\bon[A-Z][A-Za-z]+\s*=/.test(content);
    const hasBrowserApi = /\b(window|document|localStorage|sessionStorage|navigator|ResizeObserver|IntersectionObserver|matchMedia|MutationObserver)\b/.test(content);

    if (!hasInteractivity && !hasBrowserApi) {
      this.add({
        severity: 'high',
        category: 'react',
        rule: 'unnecessary-use-client',
        file: rel,
        message: "Client boundary detected without obvious hooks, event handlers, navigation hooks, or browser APIs.",
        fix: "Remove 'use client' or push it down into a leaf component that actually needs browser interactivity.",
      });
    }

    if (/\b(fetch|axios\.|ky\.|got\()/.test(content)) {
      this.add({
        severity: 'high',
        category: 'react',
        rule: 'client-data-fetching',
        file: rel,
        message: 'Client Component performs data fetching. This usually adds waterfalls, hydration work, and duplicated loading states.',
        fix: 'Move reads to Server Components/cached data functions; keep Client Components for interactivity only.',
      });
    }

    if (/useEffect\s*\([\s\S]{0,1400}\b(fetch|axios\.|ky\.|got\()/.test(content)) {
      this.add({
        severity: 'critical',
        category: 'react',
        rule: 'effect-data-fetching',
        file: rel,
        message: 'useEffect is used for data fetching in a Client Component. This causes slow client-rendered UX and waterfalls.',
        fix: 'Fetch on the server, stream with loading.tsx/Suspense, or use a client cache only for explicitly client-owned state.',
      });
    }

    for (const importName of SERVER_ONLY_IMPORTS) {
      if (hasRuntimeImport(content, importName)) {
        this.add({
          severity: 'critical',
          category: 'react',
          rule: 'server-module-in-client',
          file: rel,
          message: `Client Component imports server-only module ${importName}.`,
          fix: 'Move the import to a Server Component, route handler, or server action. Pass serializable data into the client boundary.',
        });
      }
    }

    for (const importName of HEAVY_CLIENT_IMPORTS) {
      if (hasRuntimeImport(content, importName)) {
        this.add({
          severity: 'medium',
          category: 'bundle',
          rule: 'heavy-client-import',
          file: rel,
          message: `Client Component imports a commonly heavy package entry point (${importName}).`,
          fix: 'Prefer server-side formatting/rendering, subpath imports, or dynamic import behind interaction.',
        });
      }
    }

    if (/export\s+const\s+metadata\b|export\s+async\s+function\s+generateMetadata\b/.test(content)) {
      this.add({
        severity: 'critical',
        category: 'next',
        rule: 'metadata-in-client-component',
        file: rel,
        message: 'Client Component exports metadata/generateMetadata, which belongs in Server Components.',
        fix: 'Move metadata exports to a server layout/page file.',
      });
    }
  }

  auditServerOrSharedSource(content, rel) {
    if (/(^|\/)app\//.test(rel) && /\b(window|document|localStorage|sessionStorage)\b/.test(content)) {
      this.add({
        severity: 'high',
        category: 'react',
        rule: 'browser-api-outside-client-boundary',
        file: rel,
        message: 'Browser API appears in an App Router file without a client directive.',
        fix: "Move browser API usage into a small leaf component with 'use client', or guard it behind server-safe boundaries.",
      });
    }
  }

  auditServerActionFile(content, rel) {
    const validatesWithSchema = /\b(z|zod|valibot|v|yup|arktype|schema)\b[\s\S]{0,600}\b(parse|safeParse|validate|assert)\b/.test(content);
    const exportsFunction = /export\s+(async\s+)?function\s+|export\s+const\s+\w+\s*=\s*(async\s*)?\(/.test(content);
    const appearsMutating = /\b(create|update|delete|upsert|insert|remove|connect|disconnect|set\(|push\(|prisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany))\b/.test(content);

    if (exportsFunction && !validatesWithSchema) {
      this.add({
        severity: 'critical',
        category: 'security',
        rule: 'server-action-no-validation',
        file: rel,
        message: 'Server Action file exports callable functions without obvious schema validation.',
        fix: 'Validate every external input with zod/valibot/arktype at the action boundary and authorize before mutation.',
      });
    }

    if (exportsFunction && appearsMutating && !hasAuthCheck(content)) {
      this.add({
        severity: 'high',
        category: 'security',
        rule: 'server-action-no-auth-check',
        file: rel,
        message: 'Mutating Server Action has no obvious authorization/session check.',
        fix: 'Load the actor, verify permissions for the target resource, then mutate.',
      });
    }

    if (/redirect\s*\([\s\S]{0,240}(formData|get\(|searchParams|url\.searchParams)/.test(content)) {
      this.add({
        severity: 'high',
        category: 'security',
        rule: 'possible-open-redirect',
        file: rel,
        message: 'Server Action may redirect using untrusted input.',
        fix: 'Map redirect targets to an allowlist of internal paths before calling redirect().',
      });
    }
  }

  auditRouteHandler(content, rel) {
    if (!/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/.test(content)) return;

    if (/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(content)) {
      const validates = /\b(z|zod|valibot|v|yup|arktype|schema)\b[\s\S]{0,800}\b(parse|safeParse|validate|assert)\b/.test(content);
      if (!validates) {
        this.add({
          severity: 'critical',
          category: 'security',
          rule: 'route-handler-no-validation',
          file: rel,
          message: 'Mutating route handler does not show obvious request body validation.',
          fix: 'Parse JSON/form data once, validate with a schema, authorize the actor, then perform the mutation.',
        });
      }
      if (!hasAuthCheck(content)) {
        this.add({
          severity: 'high',
          category: 'security',
          rule: 'route-handler-no-auth-check',
          file: rel,
          message: 'Mutating route handler has no obvious auth/session/permission check.',
          fix: 'Authenticate and authorize the request before mutation.',
        });
      }
    }

    if (/export\s+async\s+function\s+GET/.test(content) && /\b(fetch\(|prisma\.|db\.|sql`|axios\.)/.test(content) && !/('use cache'|"use cache"|cacheLife\(|cacheTag\(|unstable_cache\(|revalidatePath\(|revalidateTag\(|Cache-Control|dynamic\s*=\s*['"]force-dynamic['"])/.test(content)) {
      this.add({
        severity: 'medium',
        category: 'next',
        rule: 'get-route-no-cache-policy',
        file: rel,
        message: 'GET route handler appears to read data but has no obvious cache, revalidation, or dynamic policy.',
        fix: 'Declare whether this endpoint is dynamic, cached, tagged, or CDN-cacheable. Do not leave behavior accidental.',
      });
    }

    if (/Access-Control-Allow-Origin['"]?\s*,\s*['"]\*/.test(content)) {
      this.add({
        severity: 'high',
        category: 'security',
        rule: 'wildcard-cors',
        file: rel,
        message: 'Route handler appears to set wildcard CORS.',
        fix: 'Use an origin allowlist and never combine wildcard origins with credentials.',
      });
    }
  }

  auditPageOrLayout(content, rel) {
    if (/async\s+function\s+\w+|export\s+default\s+async\s+function/.test(content) && !/(loading\.(tsx|jsx|ts|js)|Suspense\b|<Suspense)/.test(content)) {
      this.add({
        severity: 'low',
        category: 'next',
        rule: 'async-page-without-visible-streaming-boundary',
        file: rel,
        message: 'Async page/layout has no visible Suspense boundary in the same file. This can be valid if loading.tsx or nested boundaries exist.',
        fix: 'Use loading.tsx, route groups, or Suspense around slow sections so the shell can stream quickly.',
      });
    }

    if (/\bexport\s+const\s+runtime\s*=\s*['"]edge['"]/.test(content)) {
      for (const importName of NODE_EDGE_RISK_IMPORTS) {
        if (importRegex(importName).test(content) || new RegExp(`\\b${escapeRegExp(importName.split('/').at(-1))}\\b`).test(content)) {
          this.add({
            severity: 'critical',
            category: 'next',
            rule: 'edge-runtime-node-dependency',
            file: rel,
            message: `Edge runtime segment appears to use Node/database dependency ${importName}.`,
            fix: 'Use nodejs runtime for this segment or switch to edge-compatible clients and APIs.',
          });
          break;
        }
      }
    }
  }

  auditAppFile(content, rel) {
    if (/<img\b/.test(content) && !/\/\*\s*hyperdrive-ignore-img\s*\*\//.test(content)) {
      this.add({
        severity: 'medium',
        category: 'next',
        rule: 'native-img-in-app',
        file: rel,
        message: 'Native <img> found in app source. This bypasses Next image optimization unless intentional.',
        fix: 'Use next/image for local/remote optimized images, or annotate intentional raw images with /* hyperdrive-ignore-img */.',
      });
    }

    if (/from\s+['"]next\/router['"]/.test(content)) {
      this.add({
        severity: 'high',
        category: 'next',
        rule: 'pages-router-import-in-app',
        file: rel,
        message: 'App Router source imports next/router.',
        fix: 'Use next/navigation in App Router code.',
      });
    }

    if (/<Image\b[\s\S]{0,400}\bfill\b/.test(content) && !/sizes\s*=/.test(content)) {
      this.add({
        severity: 'medium',
        category: 'next',
        rule: 'image-fill-without-sizes',
        file: rel,
        message: 'next/image uses fill without a visible sizes prop.',
        fix: 'Add sizes to avoid oversized image downloads.',
      });
    }
  }

  auditGeneralSource(content, rel) {
    if (/dangerouslySetInnerHTML\s*=/.test(content) && !/(sanitize|dompurify|trustedTypes|TrustedHTML)/i.test(content)) {
      this.add({
        severity: 'high',
        category: 'security',
        rule: 'unsafe-html-injection',
        file: rel,
        message: 'dangerouslySetInnerHTML is used without obvious sanitization.',
        fix: 'Sanitize at the boundary and document the trusted source of the HTML.',
      });
    }

    if (/process\.env\.NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|KEY|PASSWORD|PRIVATE)/.test(content)) {
      this.add({
        severity: 'critical',
        category: 'security',
        rule: 'public-secret-env',
        file: rel,
        message: 'A NEXT_PUBLIC_* environment variable appears to contain secret-like material.',
        fix: 'Remove secrets from public env vars. Use server-only environment variables and server-side calls.',
      });
    }

    if (/\b(eval|new Function)\s*\(/.test(content)) {
      this.add({
        severity: 'critical',
        category: 'security',
        rule: 'dynamic-code-execution',
        file: rel,
        message: 'Dynamic code execution detected.',
        fix: 'Remove eval/new Function. Use explicit parsers or vetted expression evaluators if unavoidable.',
      });
    }

    if (/console\.(log|debug)\(/.test(content) && /(^|\/)app\//.test(rel)) {
      this.add({
        severity: 'low',
        category: 'quality',
        rule: 'console-in-app-source',
        file: rel,
        message: 'console.log/debug found in app source.',
        fix: 'Remove debug logging or route it through a structured logger with environment controls.',
      });
    }

    if (/^\s*(?:\/\/|\*)\s*(?:TODO|FIXME|HACK)\b/m.test(content) && this.strictish()) {
      this.add({
        severity: 'info',
        category: 'quality',
        rule: 'todo-marker',
        file: rel,
        message: 'TODO/FIXME/HACK marker found.',
        fix: 'Track with an issue or remove before release-critical paths ship.',
      });
    }
  }


  auditAstImportGraph() {
    if (!this.astGraph) return;
    const nodes = this.astGraph.nodes;
    const clientRoots = [...nodes.values()].filter((node) => node.directives.has('use client'));
    const serverRoots = [...nodes.values()].filter((node) => this.isServerRuntimeRoot(node));

    const clientReachable = new Set();
    for (const root of clientRoots) {
      const reachable = this.collectReachableRuntimeNodes(root.rel, 30);
      for (const rel of reachable) clientReachable.add(rel);
    }

    const serverReachable = new Set();
    for (const root of serverRoots) {
      const reachable = this.collectReachableRuntimeNodes(root.rel, 30);
      for (const rel of reachable) serverReachable.add(rel);
    }

    for (const root of clientRoots) {
      const chain = this.findImportChain(root.rel, (node) => node.rel !== root.rel && this.isServerTaintedNode(node), 30);
      if (chain) {
        const target = nodes.get(chain.at(-1));
        this.add({
          severity: 'critical',
          category: 'architecture',
          rule: 'client-graph-imports-server-code',
          file: root.rel,
          message: `Client Component runtime graph reaches server-only code: ${chain.join(' -> ')}.`,
          fix: 'Split server data access from the client leaf. Pass serialized data/actions through a Server Component boundary instead of importing server modules into client code.',
          autofix: {
            kind: 'manual-codemod',
            confidence: 'medium',
            title: 'Split client/server module graph',
            targetFile: root.rel,
            relatedFiles: chain,
            steps: [
              `Move server-only logic out of ${target?.rel || 'the target module'} into a *.server.ts or app-level Server Component/data function.`,
              'Replace the client import with serializable props or a validated Server Action call.',
              'Add import "server-only" to the server module and keep "use client" only on the interactive leaf.',
            ],
          },
        });
      }

      const heavyChain = this.findImportChain(root.rel, (node) => node.rel !== root.rel && node.heavyClientImports.size > 0, 30);
      if (heavyChain) {
        const target = nodes.get(heavyChain.at(-1));
        this.add({
          severity: 'medium',
          category: 'performance',
          rule: 'client-graph-heavy-dependency',
          file: root.rel,
          message: `Client bundle graph reaches heavy dependency (${[...(target?.heavyClientImports || [])].join(', ')}): ${heavyChain.join(' -> ')}.`,
          fix: 'Move the heavy dependency behind a dynamic import, replace with a smaller module-level import, or render the expensive section on the server.',
          autofix: {
            kind: 'suggestion',
            confidence: 'medium',
            title: 'Reduce client bundle dependency weight',
            targetFile: target?.rel || root.rel,
            steps: [
              'Prefer named per-module imports over broad package imports where the library supports it.',
              'Use next/dynamic for non-critical interactive visualizations.',
              'Move pure formatting/transformation work to a Server Component or cached data function.',
            ],
          },
        });
      }
    }

    for (const root of serverRoots) {
      const chain = this.findImportChain(root.rel, (node) => node.rel !== root.rel && this.isClientTaintedNode(node), 30);
      if (chain) {
        this.add({
          severity: this.isHardServerRuntimeRoot(root) ? 'critical' : 'high',
          category: 'architecture',
          rule: 'server-runtime-imports-client-code',
          file: root.rel,
          message: `Server runtime graph reaches client-only code: ${chain.join(' -> ')}.`,
          fix: 'Do not import client modules from Server Actions, route handlers, middleware, server-only utilities, or database modules. Invert the dependency or move UI code behind a Server Component boundary.',
          autofix: {
            kind: 'manual-codemod',
            confidence: 'medium',
            title: 'Remove client code from server runtime graph',
            targetFile: root.rel,
            relatedFiles: chain,
            steps: [
              'Extract browser/React-hook logic into a *.client.tsx file with "use client".',
              'Keep the server file free of JSX client dependencies and browser globals.',
              'Pass data from the server runtime into the client component through serializable props.',
            ],
          },
        });
      }
    }

    for (const rel of clientReachable) {
      const node = nodes.get(rel);
      if (!node) continue;
      if (node.barrelExportCount >= 8) {
        this.add({
          severity: 'medium',
          category: 'performance',
          rule: 'client-graph-internal-barrel',
          file: rel,
          message: `Client bundle graph includes an internal barrel file with ${node.barrelExportCount} re-exports. Internal barrels can defeat tree-shaking and slow dev/build startup.`,
          fix: 'Import directly from concrete component/module files for client paths, or split server-only and client-safe barrel entrypoints.',
          autofix: {
            kind: 'suggestion',
            confidence: 'low',
            title: 'Replace internal barrel imports in client graph',
            targetFile: rel,
            steps: ['Find imports that target this barrel from client-reachable files.', 'Rewrite them to direct file imports one symbol at a time and verify bundle output.'],
          },
        });
      }
    }

    for (const rel of serverReachable) {
      const node = nodes.get(rel);
      if (!node) continue;
      if (clientReachable.has(rel) && !node.directives.has('use client') && !node.directives.has('use server') && this.isEnvironmentSpecificNode(node)) {
        this.add({
          severity: 'critical',
          category: 'architecture',
          rule: 'shared-module-crosses-client-server-boundary',
          file: rel,
          message: 'Module is reachable from both client and server runtime graphs while using environment-specific APIs/imports.',
          fix: 'Split this shared module into explicit .client and .server modules, then expose only environment-neutral types/utilities from the shared entrypoint.',
          autofix: {
            kind: 'manual-codemod',
            confidence: 'medium',
            title: 'Split mixed environment module',
            targetFile: rel,
            steps: [
              `Create ${rel.replace(/(\.[cm]?[tj]sx?)$/, '.server$1')} for server-only imports and data access.`,
              `Create ${rel.replace(/(\.[cm]?[tj]sx?)$/, '.client$1')} for browser APIs, hooks, and interactive UI.`,
              'Keep the original module limited to type exports or pure environment-neutral functions.',
            ],
          },
        });
      }
    }

    this.auditPackageBoundaryGraph();
    this.auditImportCycles();
  }

  isServerRuntimeRoot(node) {
    return this.isHardServerRuntimeRoot(node) || node.serverOnlyImports.size > 0 || /(^|\/)(server|db|database|auth|stripe|payments)(\/|\.)/.test(node.rel);
  }

  isHardServerRuntimeRoot(node) {
    return node.directives.has('use server') || /(^|\/)middleware\.(ts|js)$/.test(node.rel) || /\/route\.(ts|js)$/.test(node.rel);
  }

  isServerTaintedNode(node) {
    return node.directives.has('use server') || node.serverOnlyImports.size > 0 || node.usesServerEnv || /\/route\.(ts|js)$/.test(node.rel) || /(^|\/)(server|db|database)(\/|\.)/.test(node.rel);
  }

  isClientTaintedNode(node) {
    return node.directives.has('use client') || node.clientOnlyImports.size > 0 || node.usesBrowserApi || node.usesReactClientHook;
  }

  isEnvironmentSpecificNode(node) {
    return this.isServerTaintedNode(node) || this.isClientTaintedNode(node);
  }

  collectReachableRuntimeNodes(startRel, maxDepth = 30) {
    const visited = new Set();
    const queue = [{ rel: startRel, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.rel) || current.depth > maxDepth) continue;
      visited.add(current.rel);
      const node = this.astGraph.nodes.get(current.rel);
      if (!node) continue;
      for (const nextRel of node.internalImports) {
        if (!visited.has(nextRel)) queue.push({ rel: nextRel, depth: current.depth + 1 });
      }
    }
    return visited;
  }

  findImportChain(startRel, predicate, maxDepth = 30) {
    const queue = [{ rel: startRel, chain: [startRel], depth: 0 }];
    const visited = new Set();
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.rel) || current.depth > maxDepth) continue;
      visited.add(current.rel);
      const node = this.astGraph.nodes.get(current.rel);
      if (!node) continue;
      if (predicate(node, current.chain)) return current.chain;
      for (const nextRel of node.internalImports) {
        if (!visited.has(nextRel)) queue.push({ rel: nextRel, chain: [...current.chain, nextRel], depth: current.depth + 1 });
      }
    }
    return null;
  }

  auditPackageBoundaryGraph() {
    if (!this.astGraph) return;
    for (const edge of this.astGraph.edges) {
      if (edge.external || edge.typeOnly) continue;
      const fromParts = edge.from.split('/');
      const toParts = edge.to.split('/');
      if (fromParts[0] === 'packages' && toParts[0] === 'apps') {
        this.add({
          severity: 'critical',
          category: 'architecture',
          rule: 'package-imports-app-code',
          file: edge.from,
          message: `Reusable package imports deployable app code (${edge.to}). This inverts workspace ownership.`,
          fix: 'Move shared code into packages/* or invert the dependency so apps depend on packages, not the reverse.',
          autofix: { kind: 'manual-codemod', confidence: 'high', title: 'Move shared code out of app', targetFile: edge.from, relatedFiles: [edge.to] },
        });
      }
      if (fromParts[0] === 'apps' && toParts[0] === 'apps' && fromParts[1] !== toParts[1]) {
        this.add({
          severity: 'high',
          category: 'architecture',
          rule: 'app-imports-sibling-app',
          file: edge.from,
          message: `App ${fromParts[1]} imports sibling app code from ${edge.to}.`,
          fix: 'Extract the shared module into packages/* and import it through a package boundary.',
          autofix: { kind: 'manual-codemod', confidence: 'high', title: 'Extract sibling app dependency', targetFile: edge.from, relatedFiles: [edge.to] },
        });
      }
    }
  }

  auditImportCycles() {
    if (!this.astGraph || !this.strictish()) return;
    const nodes = this.astGraph.nodes;
    const visiting = new Set();
    const visited = new Set();
    const cycles = [];
    const walk = (rel, stack) => {
      if (cycles.length >= 20) return;
      if (visiting.has(rel)) {
        const start = stack.indexOf(rel);
        if (start >= 0) cycles.push([...stack.slice(start), rel]);
        return;
      }
      if (visited.has(rel)) return;
      visiting.add(rel);
      const node = nodes.get(rel);
      if (node) {
        for (const nextRel of node.internalImports) walk(nextRel, [...stack, nextRel]);
      }
      visiting.delete(rel);
      visited.add(rel);
    };
    for (const rel of nodes.keys()) walk(rel, [rel]);
    for (const cycle of cycles) {
      this.add({
        severity: 'low',
        category: 'architecture',
        rule: 'runtime-import-cycle',
        file: cycle[0],
        message: `Runtime import cycle detected: ${cycle.join(' -> ')}.`,
        fix: 'Break cycles by extracting shared types/constants into a third module or inverting side-effectful dependencies.',
        autofix: { kind: 'suggestion', confidence: 'low', title: 'Break runtime import cycle', relatedFiles: cycle },
      });
    }
  }

  auditPrisma() {
    const schemas = this.files.filter((file) => file.endsWith('schema.prisma'));
    if (schemas.length === 0) return;

    const allDeps = mergePackageDeps(this.packageIndex.map((entry) => entry.deps));
    const prismaMajor = parseMajor(allDeps.prisma || allDeps['@prisma/client']);
    const prismaConfigs = this.files.filter((file) => PRISMA_CONFIG_FILES.some((config) => this.rel(file).endsWith(config)));

    if (prismaMajor >= 7 && prismaConfigs.length === 0) {
      this.add({
        severity: 'high',
        category: 'prisma',
        rule: 'missing-prisma-config',
        file: 'prisma.config.ts',
        message: 'Prisma 7+ is detected but no prisma.config.* file was found.',
        fix: 'Add prisma.config.ts with schema, migrations, and datasource.url configured through prisma/config env().',
      });
    }

    for (const configFile of prismaConfigs) {
      const rel = this.rel(configFile);
      const content = this.readFile(configFile);
      if (/directUrl\s*:/.test(content)) {
        this.add({
          severity: 'critical',
          category: 'prisma',
          rule: 'prisma-config-direct-url',
          file: rel,
          message: 'prisma.config.* contains datasource.directUrl, which Prisma 7 config removed.',
          fix: 'Use datasource.url and update migration/deployment workflows for Prisma 7.',
        });
      }
      if (!/datasource\s*:\s*{[\s\S]{0,400}\burl\s*:/.test(content)) {
        this.add({
          severity: 'medium',
          category: 'prisma',
          rule: 'prisma-config-missing-datasource-url',
          file: rel,
          message: 'Prisma config does not show datasource.url.',
          fix: 'Set datasource.url using env("DATABASE_URL") in prisma.config.*.',
        });
      }
    }

    for (const schema of schemas) {
      const rel = this.rel(schema);
      const content = this.readFile(schema);

      if (/provider\s*=\s*['"]sqlite['"]/.test(content) && this.hasNextDependency()) {
        this.add({
          severity: 'medium',
          category: 'prisma',
          rule: 'sqlite-next-production-risk',
          file: rel,
          message: 'Prisma schema uses SQLite in a Next.js monorepo. This is usually unsuitable for horizontally scaled production apps.',
          fix: 'Use Postgres/MySQL for production unless this app is intentionally single-node/local.',
        });
      }

      if (prismaMajor >= 7 && /provider\s*=\s*['"]prisma-client-js['"]/.test(content)) {
        this.add({
          severity: 'medium',
          category: 'prisma',
          rule: 'legacy-prisma-client-js-generator',
          file: rel,
          message: 'Prisma 7+ detected with legacy prisma-client-js generator.',
          fix: 'Evaluate the new prisma-client generator with an explicit output path and generated type imports.',
        });
      }

      if (/provider\s*=\s*['"]prisma-client['"]/.test(content) && !/output\s*=\s*['"]/.test(content)) {
        this.add({
          severity: 'critical',
          category: 'prisma',
          rule: 'prisma-client-generator-missing-output',
          file: rel,
          message: 'The prisma-client generator requires an explicit output path.',
          fix: 'Add output = "../src/generated/prisma" or another committed/generated client path.',
        });
      }

      if (/provider\s*=\s*['"]prisma-client['"]/.test(content) && this.hasNextDependency() && !/runtime\s*=\s*['"](nodejs|vercel-edge|edge-light|workerd|cloudflare|bun)['"]/.test(content)) {
        this.add({
          severity: 'low',
          category: 'prisma',
          rule: 'prisma-client-runtime-not-explicit',
          file: rel,
          message: 'prisma-client generator runtime is not explicit.',
          fix: 'Set runtime intentionally for nodejs, vercel-edge, workerd/cloudflare, or bun depending on deployment target.',
        });
      }

      const relationFields = findRelationScalarFields(content);
      for (const fieldName of relationFields) {
        if (!fieldHasIndex(content, fieldName)) {
          this.add({
            severity: 'medium',
            category: 'prisma',
            rule: 'relation-field-missing-index',
            file: rel,
            message: `Relation scalar field ${fieldName} does not appear to have an index.`,
            fix: `Add @@index([${fieldName}]) unless the field is covered by @id, @unique, @@unique, or an existing compound index.`,
          });
        }
      }

      if (!/(prisma\+postgres:\/\/|accelerate|pgbouncer|pool_timeout|connection_limit|pooler|transaction-pooler)/i.test(content) && this.hasServerlessHint()) {
        this.add({
          severity: 'medium',
          category: 'prisma',
          rule: 'no-pooling-hint',
          file: rel,
          message: 'Serverless/edge deployment hints detected, but Prisma schema does not show an obvious pooling/Accelerate strategy.',
          fix: 'Use a compatible connection pooler/Accelerate/driver adapter strategy and test cold-start connection behavior.',
        });
      }
    }

    const sourceFiles = this.files.filter((file) => SOURCE_EXTENSIONS.has(extname(file)));
    for (const file of sourceFiles) {
      const rel = this.rel(file);
      const content = this.readFile(file);
      if (hasUseDirective(content, 'client') && /generated\/prisma\/client|@prisma\/client/.test(content)) {
        this.add({
          severity: 'critical',
          category: 'prisma',
          rule: 'prisma-client-imported-in-client-component',
          file: rel,
          message: 'Client Component imports Prisma client/server output.',
          fix: 'Use generated browser.ts/models.ts type-only imports for frontend-safe types; never import PrismaClient into client code.',
        });
      }
      if (/new\s+PrismaClient\s*\(/.test(content) && !/globalThis\.|singleton|declare\s+global/.test(content) && /(^|\/)app\//.test(rel)) {
        this.add({
          severity: 'medium',
          category: 'prisma',
          rule: 'prisma-client-created-in-app-file',
          file: rel,
          message: 'PrismaClient appears to be instantiated directly in app source.',
          fix: 'Centralize PrismaClient creation in a server-only db module with dev singleton handling.',
        });
      }
    }
  }

  auditTailwindAndShadcn() {
    const allDeps = mergePackageDeps(this.packageIndex.map((entry) => entry.deps));
    if (!hasAnyDep(allDeps, ['tailwindcss', '@tailwindcss/postcss'])) return;

    const tailwindConfigs = this.files.filter((file) => /^tailwind\.config\.(ts|js|mjs|cjs)$/.test(basename(file)) || basename(file) === 'globals.css');
    if (tailwindConfigs.length === 0) {
      this.add({
        severity: 'low',
        category: 'ui',
        rule: 'tailwind-config-not-found',
        message: 'Tailwind dependency detected, but no tailwind config or globals.css was indexed.',
        fix: 'Verify Tailwind v4 CSS entrypoint or v3 config is present and included in app layout.',
      });
    }

    if (hasAnyDep(allDeps, ['class-variance-authority', 'clsx', 'tailwind-merge']) && !existsSync(join(this.root, 'components.json'))) {
      this.add({
        severity: 'info',
        category: 'ui',
        rule: 'shadcn-components-json-missing',
        file: 'components.json',
        message: 'shadcn-style dependencies detected, but components.json is missing at the root.',
        fix: 'Add components.json or document the custom component-generation setup.',
      });
    }
  }

  auditCiAndRepoQuality() {
    const workflowsDir = join(this.root, '.github', 'workflows');
    if (!existsSync(workflowsDir)) {
      this.add({
        severity: 'low',
        category: 'developer-experience',
        rule: 'missing-github-actions',
        file: '.github/workflows',
        message: 'No GitHub Actions workflow directory found.',
        fix: 'Add CI that runs install, lint, typecheck, tests, hyperdrive audit, and build.',
      });
    }

    if (!existsSync(join(this.root, '.env.example')) && !existsSync(join(this.root, '.env.sample'))) {
      this.add({
        severity: 'low',
        category: 'developer-experience',
        rule: 'missing-env-example',
        file: '.env.example',
        message: 'No .env.example/.env.sample found. Onboarding and CI setup will be slower and riskier.',
        fix: 'Add an example env file with required variable names and safe placeholder values.',
      });
    }
  }

  auditLockfileStrategy() {
    const present = LOCK_FILES.filter((file) => existsSync(join(this.root, file)));
    if (present.length > 1) {
      this.add({
        severity: 'high',
        category: 'repository',
        rule: 'multiple-lockfiles',
        message: `Multiple lockfiles detected: ${present.join(', ')}.`,
        fix: 'Standardize on one package manager and remove stale lockfiles to avoid nondeterministic installs.',
      });
    }
  }



  auditEnvironment() {
    const envExampleRel = existsSync(join(this.root, '.env.example')) ? '.env.example' : (existsSync(join(this.root, '.env.sample')) ? '.env.sample' : null);
    const envExample = envExampleRel ? this.readFile(envExampleRel) : '';
    const exampleVars = new Set([...envExample.matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)].map((m) => m[1]));
    const used = new Map();
    const envValidationCandidates = ['env.ts', 'env.mjs', 'src/env.ts', 'src/env.mjs', 'lib/env.ts', 'lib/env.mjs', 'apps/web/src/env.ts', 'apps/web/lib/env.ts'];
    const hasValidationModule = envValidationCandidates.some((rel) => existsSync(join(this.root, rel)));

    for (const file of this.files.filter((f) => SOURCE_EXTENSIONS.has(extname(f)))) {
      const rel = this.rel(file);
      const content = this.readFile(file);
      for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        const key = match[1];
        const loc = this.locationForIndex(content, match.index || 0);
        if (!used.has(key)) used.set(key, []);
        used.get(key).push({ file: rel, line: loc.line, column: loc.column });
        if (!hasValidationModule && !rel.endsWith('env.ts') && !rel.endsWith('env.mjs')) {
          this.add({ severity: 'low', category: 'env', rule: 'process-env-access-not-centralized', file: rel, line: loc.line, column: loc.column, message: `Direct process.env.${key} access outside a centralized env validation module.`, fix: 'Centralize env parsing in env.ts with zod/valibot and import validated values from there.' });
        }
      }
    }

    if (!hasValidationModule && used.size > 0) {
      this.add({ severity: 'medium', category: 'env', rule: 'env-validation-module-missing', file: 'env.ts', message: 'Environment variables are used but no centralized env validation module was found.', fix: 'Create env.ts/src/env.ts that validates all required variables at process startup.' });
    }

    for (const [key, locations] of used.entries()) {
      if (!exampleVars.has(key) && !key.startsWith('NEXT_PUBLIC_VERCEL_')) {
        const first = locations[0];
        this.add({ severity: key.startsWith('NEXT_PUBLIC_') && /SECRET|TOKEN|KEY|PASSWORD|PRIVATE/i.test(key) ? 'high' : 'medium', category: 'env', rule: key.startsWith('NEXT_PUBLIC_') && /SECRET|TOKEN|KEY|PASSWORD|PRIVATE/i.test(key) ? 'next-public-env-looks-secret' : 'env-used-but-missing-example', file: first.file, line: first.line, column: first.column, message: `${key} is used in source but missing from ${envExampleRel || '.env.example'}.`, fix: key.startsWith('NEXT_PUBLIC_') && /SECRET|TOKEN|KEY|PASSWORD|PRIVATE/i.test(key) ? 'Do not expose secret-looking env names through NEXT_PUBLIC_. Move it server-side.' : `Add ${key}= to .env.example with a safe placeholder.` });
      }
    }

    for (const key of exampleVars) {
      if (!used.has(key) && !key.startsWith('NEXT_PUBLIC_')) {
        const idx = envExample.indexOf(key);
        const loc = this.locationForIndex(envExample, idx >= 0 ? idx : 0);
        this.add({ severity: 'info', category: 'env', rule: 'env-example-unused', file: envExampleRel, line: loc.line, column: loc.column, message: `${key} is present in ${envExampleRel} but was not found in source.`, fix: 'Remove stale env examples or confirm the variable is consumed outside source scanning.' });
      }
    }

    if (this.astGraph) {
      const clientReachable = this.collectReachableFromClientEntries();
      for (const rel of clientReachable) {
        const content = this.readFile(rel);
        for (const match of content.matchAll(/process\.env\.((?!NEXT_PUBLIC_)[A-Z0-9_]+)/g)) {
          const loc = this.locationForIndex(content, match.index || 0);
          this.add({ severity: 'critical', category: 'env', rule: 'server-env-used-in-client-graph', file: rel, line: loc.line, column: loc.column, message: `Server-only env ${match[1]} is reachable from the client module graph.`, fix: 'Move this access behind a Server Component, route handler, or validated Server Action and pass only serializable public data to the client.' });
        }
      }
    }
  }

  auditDockerAndDeployment() {
    const dockerFiles = this.files.filter((file) => basename(file).toLowerCase() === 'dockerfile' || basename(file).startsWith('Dockerfile'));
    const composeFiles = this.files.filter((file) => /docker-compose.*\.ya?ml$|compose.*\.ya?ml$/i.test(basename(file)));
    const nextConfigs = this.files.filter((file) => NEXT_CONFIG_FILES.includes(basename(file)));
    const nextStandalone = nextConfigs.some((file) => /output\s*:\s*['"]standalone['"]/.test(this.readFile(file)));
    for (const file of dockerFiles) {
      const rel = this.rel(file);
      const content = this.readFile(file);
      if (!nextStandalone && this.hasNextDependency()) {
        this.add({ severity: 'medium', category: 'deployment', rule: 'docker-next-standalone-missing', file: rel, message: 'Dockerfile detected but Next config does not enable output: standalone.', fix: 'Set output: "standalone" for Docker deployments or document why standalone output is not used.' });
      }
      if (!/^\s*USER\s+[^\s]+/mi.test(content)) this.add({ severity: 'high', category: 'deployment', rule: 'docker-runs-as-root', file: rel, message: 'Dockerfile does not switch to a non-root USER.', fix: 'Create and switch to an unprivileged user before CMD/ENTRYPOINT.' });
      if (/COPY\s+\.\s+\./i.test(content) && /bun install|npm install|pnpm install|yarn install/i.test(content) && content.indexOf('COPY . .') < content.search(/bun install|npm install|pnpm install|yarn install/i)) this.add({ severity: 'low', category: 'deployment', rule: 'docker-cache-inefficient-copy', file: rel, message: 'Dockerfile appears to copy the entire repo before dependency install.', fix: 'Copy package manifests/lockfiles first, install dependencies, then copy source to preserve Docker layer cache.' });
      if (!/^\s*HEALTHCHECK\b/mi.test(content)) this.add({ severity: 'low', category: 'deployment', rule: 'docker-healthcheck-missing', file: rel, message: 'Dockerfile lacks a HEALTHCHECK.', fix: 'Add a lightweight healthcheck endpoint and Docker HEALTHCHECK instruction.' });
    }
    for (const file of composeFiles) {
      const rel = this.rel(file);
      const content = this.readFile(file);
      for (const match of content.matchAll(/(PASSWORD|SECRET|TOKEN|API_KEY|DATABASE_URL)\s*[:=]\s*[^\s$][^\n]*/gi)) {
        const loc = this.locationForIndex(content, match.index || 0);
        this.add({ severity: 'high', category: 'deployment', rule: 'compose-inline-secret', file: rel, line: loc.line, column: loc.column, message: 'Compose file appears to contain an inline secret.', fix: 'Use env_file, secrets, or deployment secret stores instead of inline credentials.' });
      }
      for (const match of content.matchAll(/image\s*:\s*[^\n:]+:latest\b/gi)) {
        const loc = this.locationForIndex(content, match.index || 0);
        this.add({ severity: 'medium', category: 'deployment', rule: 'compose-latest-tag', file: rel, line: loc.line, column: loc.column, message: 'Compose service uses a latest image tag.', fix: 'Pin image tags or digests for repeatable deploys.' });
      }
      if (!/healthcheck\s*:/i.test(content)) this.add({ severity: 'low', category: 'deployment', rule: 'compose-service-healthcheck-missing', file: rel, message: 'Compose file lacks service healthchecks.', fix: 'Add healthchecks for app, database, cache, and queue services where applicable.' });
    }
  }

  auditExpandedSecurity() {
    for (const file of this.files.filter((f) => SOURCE_EXTENSIONS.has(extname(f)))) {
      const rel = this.rel(file);
      const content = this.readFile(file);
      if (/(eval\s*\(|new\s+Function\s*\()/g.test(content)) {
        const idx = content.search(/eval\s*\(|new\s+Function\s*\(/);
        const loc = this.locationForIndex(content, idx);
        this.add({ severity: 'critical', category: 'security', rule: 'unsafe-dynamic-code-execution', file: rel, line: loc.line, column: loc.column, message: 'Dynamic code execution detected.', fix: 'Remove eval/new Function and replace with explicit parsers or safe dispatch tables.' });
      }
      if (/(from\s+['\"](?:node:)?child_process['\"]|require\s*\(\s*['\"](?:node:)?child_process['\"]\s*\)|\bexecSync\s*\(|\bexec\s*\(|\bspawn\s*\([^)]*shell\s*:\s*true)/s.test(content)) {
        const idx = content.search(/from\s+['\"](?:node:)?child_process['\"]|require\s*\(\s*['\"](?:node:)?child_process['\"]\s*\)|\bexecSync\s*\(|\bexec\s*\(|\bspawn\s*\(/);
        const loc = this.locationForIndex(content, idx);
        this.add({ severity: 'high', category: 'security', rule: 'unsafe-shell-execution', file: rel, line: loc.line, column: loc.column, message: 'Shell/process execution is present.', fix: 'Avoid shell execution. If required, use spawn without shell, fixed arguments, validation, and least-privilege runtime.' });
      }
      if (/createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/i.test(content)) {
        const idx = content.search(/createHash\s*\(/i);
        const loc = this.locationForIndex(content, idx);
        this.add({ severity: 'medium', category: 'security', rule: 'weak-crypto-hash', file: rel, line: loc.line, column: loc.column, message: 'Weak hash algorithm detected.', fix: 'Use SHA-256+ for checksums and a password KDF such as argon2/bcrypt/scrypt for passwords.' });
      }
      for (const match of content.matchAll(/(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)\s*=\s*['"][^'"]{12,}['"]/g)) {
        const loc = this.locationForIndex(content, match.index || 0);
        this.add({ severity: 'critical', category: 'security', rule: 'hardcoded-secret', file: rel, line: loc.line, column: loc.column, message: 'Hard-coded secret-looking value detected.', fix: 'Move the secret to a secret manager or environment variable and rotate the exposed value.' });
      }
      if (/console\.(log|error|warn|info)\s*\([^)]*(secret|token|password|authorization|cookie)/is.test(content)) {
        const idx = content.search(/console\.(log|error|warn|info)/i);
        const loc = this.locationForIndex(content, idx);
        this.add({ severity: 'high', category: 'security', rule: 'secret-logged-to-console', file: rel, line: loc.line, column: loc.column, message: 'Console logging may expose secret/token/cookie data.', fix: 'Remove sensitive logs or redact values through a structured logger.' });
      }
      if (/Access-Control-Allow-Credentials['"]?\s*[:,]\s*['"]true['"]/i.test(content) && /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]/i.test(content)) this.add({ severity: 'critical', category: 'security', rule: 'cors-wildcard-with-credentials', file: rel, message: 'Wildcard CORS origin is used with credentials.', fix: 'Use a strict allowlist and never combine credentials with Access-Control-Allow-Origin: *.' });
      if (/cookies\(\)\.set|response\.cookies\.set|Set-Cookie/i.test(content) && !/(httpOnly|secure|sameSite)/i.test(content)) this.add({ severity: 'high', category: 'security', rule: 'cookie-missing-secure-flags', file: rel, message: 'Cookie set without obvious secure/httpOnly/sameSite flags.', fix: 'Set httpOnly, secure, sameSite, path, and explicit expiration according to the cookie purpose.' });
    }
  }

  auditExpandedPackageChecks() {
    for (const entry of this.packageIndex) {
      if (entry.rel !== 'package.json' && entry.json?.private !== true && /packages\//.test(entry.rel)) this.add({ severity: 'medium', category: 'package', rule: 'internal-package-not-private', file: entry.rel, message: 'Internal workspace package is not marked private.', fix: 'Set "private": true unless this package is intentionally published.' });
      if (entry.json?.name && /@your-org\//.test(entry.json.name)) this.add({ severity: 'low', category: 'package', rule: 'placeholder-package-scope', file: entry.rel, message: 'Package name still uses @your-org placeholder scope.', fix: 'Rename packages to the real organization scope before publishing or sharing.' });
      if (!entry.json?.engines?.node) this.add({ severity: 'low', category: 'package', rule: 'node-engine-missing', file: entry.rel, message: 'Package does not declare engines.node.', fix: 'Declare a minimum Node runtime such as >=20.11.0 to match Next.js and tooling expectations.' });
    }
    this.auditDuplicateDependencyVersions();
  }

  auditDuplicateDependencyVersions() {
    const versions = new Map();
    for (const entry of this.packageIndex) {
      for (const [name, version] of Object.entries(getAllDeps(entry.json || {}))) {
        if (!versions.has(name)) versions.set(name, new Map());
        const byVersion = versions.get(name);
        if (!byVersion.has(version)) byVersion.set(version, []);
        byVersion.get(version).push(entry.rel);
      }
    }
    for (const [name, byVersion] of versions) {
      if (byVersion.size > 1 && /^(react|react-dom|next|typescript|prisma|@prisma\/client|zod|tailwindcss)$/.test(name)) {
        this.add({ severity: /^(react|react-dom|next)$/.test(name) ? 'high' : 'medium', category: 'dependencies', rule: /^(react|react-dom|next)$/.test(name) ? 'framework-version-skew' : 'duplicate-dependency-version', message: `${name} has multiple declared versions: ${[...byVersion.keys()].join(', ')}.`, fix: 'Converge framework/tooling versions across the workspace to avoid duplicate installs and inconsistent type/runtime behavior.' });
      }
    }
  }

  auditExpandedPrisma() {
    const prismaImports = [];
    for (const file of this.files.filter((f) => SOURCE_EXTENSIONS.has(extname(f)))) {
      const rel = this.rel(file);
      const content = this.readFile(file);
      if (/new\s+PrismaClient\s*\(/.test(content)) prismaImports.push(rel);
      if (/findMany\s*\([^)]*\)/s.test(content) && !/take\s*:/s.test(content) && /app\/.+\/(route|actions?)\.(ts|tsx|js|jsx)$/.test(rel)) this.add({ severity: 'high', category: 'prisma', rule: 'prisma-findmany-without-take', file: rel, message: 'findMany appears in a route/action without an obvious take limit.', fix: 'Add take, pagination cursors, and authorization-aware query bounds.' });
      if (/findMany\s*\(/.test(content) && !/(select|include)\s*:/s.test(content) && /app\/.+\/route\.(ts|js)$/.test(rel)) this.add({ severity: 'medium', category: 'prisma', rule: 'prisma-public-query-without-select', file: rel, message: 'Public route query lacks explicit select/include.', fix: 'Use select to limit returned columns and prevent accidental data exposure.' });
    }
    if (prismaImports.length > 1) this.add({ severity: 'high', category: 'prisma', rule: 'multiple-prisma-client-instances', message: `Multiple PrismaClient instantiation sites detected: ${prismaImports.slice(0, 5).join(', ')}.`, fix: 'Create one server-only db module with a development singleton and import it everywhere.' });
    const schema = this.files.find((f) => f.endsWith('prisma/schema.prisma'));
    if (schema) {
      const schemaRel = this.rel(schema);
      const schemaText = this.readFile(schema);
      if (!existsSync(join(dirname(schema), 'migrations'))) this.add({ severity: 'medium', category: 'prisma', rule: 'prisma-migrations-missing', file: schemaRel, message: 'Prisma schema exists but migrations directory is missing.', fix: 'Commit prisma/migrations for production relational databases or document db push/prototyping only usage.' });
      if (/onDelete\s*:\s*Cascade/.test(schemaText) && !/hyperdrive-review-ok|cascade-reviewed|@reviewed/i.test(schemaText)) this.add({ severity: 'medium', category: 'prisma', rule: 'prisma-cascade-delete-needs-review', file: schemaRel, message: 'Cascade delete detected without an explicit review annotation.', fix: 'Document why cascade delete is safe with a review annotation near the relation.' });
    }
    const rootPkg = this.readJson('package.json') || {};
    const scriptsText = JSON.stringify(rootPkg.scripts || {});
    if (schema && !/prisma\s+(migrate|generate)|prisma:generate|db:migrate/.test(scriptsText)) this.add({ severity: 'low', category: 'prisma', rule: 'prisma-scripts-missing', file: 'package.json', message: 'Prisma schema exists but root scripts do not expose migrate/generate commands.', fix: 'Add prisma generate and migration scripts for repeatable local/CI workflows.' });
  }

  collectReachableFromClientEntries() {
    const reachable = new Set();
    if (!this.astGraph) return reachable;
    const clientEntries = [...this.astGraph.nodes.values()].filter((node) => node.directives?.has?.('use client')).map((node) => node.rel);
    const stack = [...clientEntries];
    while (stack.length > 0) {
      const rel = stack.pop();
      if (!rel || reachable.has(rel)) continue;
      reachable.add(rel);
      const node = this.astGraph.nodes.get(rel);
      if (!node) continue;
      for (const child of node.internalImports || []) stack.push(child);
    }
    return reachable;
  }

  locationForIndex(content, index) {
    const safeIndex = Math.max(0, Number(index) || 0);
    const prefix = content.slice(0, safeIndex);
    const parts = prefix.split('\n');
    return { line: parts.length, column: parts[parts.length - 1].length + 1 };
  }

  runCodemods() {
    if (!this.options.codemod) return;
    const engine = new HyperdriveCodemodEngine({
      root: this.root,
      options: this.options,
      findings: dedupeFindings(this.findings),
      typeGraph: this.typeGraph,
      astGraph: this.astGraph,
      packageIndex: this.packageIndex,
    });
    this.codemodResult = engine.run();
    if (this.codemodResult.summary.rejected > 0) {
      this.add({
        severity: 'low',
        category: 'codemod',
        rule: 'codemod-edits-rejected',
        message: `${this.codemodResult.summary.rejected} codemod candidate(s) were rejected because they were unsafe, duplicated, or overlapped another edit.`,
        fix: 'Review the codemod output artifact and apply remaining changes manually where appropriate.',
      });
    }
    if (this.codemodResult.summary.applied > 0) {
      this.add({
        severity: 'info',
        category: 'codemod',
        rule: 'codemod-edits-applied',
        message: `Applied ${this.codemodResult.summary.applied} safe codemod edit(s) across ${this.codemodResult.summary.filesChanged} file(s).`,
        fix: 'Run git diff, lint, typecheck, tests, and the auditor again before committing.',
      });
    }
  }

  writeOptionalArtifacts() {
    if (this.options.graphOutput && this.astGraph) {
      const graphPath = isAbsolute(this.options.graphOutput) ? this.options.graphOutput : join(this.root, this.options.graphOutput);
      const payload = {
        version: VERSION,
        root: this.root,
        generatedAt: new Date().toISOString(),
        nodes: [...this.astGraph.nodes.values()].map((node) => ({
          rel: node.rel,
          directives: [...node.directives],
          imports: node.imports,
          externalImports: [...node.externalImports],
          internalImports: [...node.internalImports],
          serverOnlyImports: [...node.serverOnlyImports],
          clientOnlyImports: [...node.clientOnlyImports],
          heavyClientImports: [...node.heavyClientImports],
          usesBrowserApi: node.usesBrowserApi,
          usesServerEnv: node.usesServerEnv,
          usesReactClientHook: node.usesReactClientHook,
          barrelExportCount: node.barrelExportCount,
          typeInfo: node.typeInfo || null,
        })),
        edges: this.astGraph.edges,
      };
      writeFileSync(graphPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    }

    if (this.options.typeReportOutput && this.typeGraph) {
      const typePath = isAbsolute(this.options.typeReportOutput) ? this.options.typeReportOutput : join(this.root, this.options.typeReportOutput);
      const typePayload = {
        version: VERSION,
        root: this.root,
        generatedAt: new Date().toISOString(),
        programCount: this.typeGraph.programCount,
        analyzedFileCount: this.typeGraph.analyzedFileCount,
        diagnostics: this.typeGraph.diagnostics,
        nodes: [...this.typeGraph.nodes.values()].map((node) => ({
          rel: node.rel,
          configRel: node.configRel,
          importedSymbols: node.importedSymbols,
          typeOnlyImportValueViolations: node.typeOnlyImportValueViolations,
          typeImportOpportunities: node.typeImportOpportunities,
          clientComponentPropIssues: node.clientComponentPropIssues,
          serverToClientPropIssues: node.serverToClientPropIssues,
          serverActionSignatureIssues: node.serverActionSignatureIssues,
          exportedFunctionIssues: node.exportedFunctionIssues,
        })),
      };
      writeFileSync(typePath, `${JSON.stringify(typePayload, null, 2)}\n`, 'utf8');
    }

    if (this.options.fixSuggestionsOutput) {
      const suggestionsPath = isAbsolute(this.options.fixSuggestionsOutput) ? this.options.fixSuggestionsOutput : join(this.root, this.options.fixSuggestionsOutput);
      const suggestions = dedupeFindings(this.findings)
        .filter((finding) => finding.autofix)
        .map((finding) => ({
          severity: finding.severity,
          category: finding.category,
          rule: finding.rule,
          file: finding.file,
          message: finding.message,
          autofix: finding.autofix,
        }));
      writeFileSync(suggestionsPath, `${JSON.stringify({ version: VERSION, generatedAt: new Date().toISOString(), suggestions }, null, 2)}\n`, 'utf8');
    }

    if (this.options.codemodOutput && this.codemodResult) {
      const codemodPath = isAbsolute(this.options.codemodOutput) ? this.options.codemodOutput : join(this.root, this.options.codemodOutput);
      writeFileSync(codemodPath, `${JSON.stringify(this.codemodResult, null, 2)}\n`, 'utf8');
    }

    if (this.options.budgetOutput) {
      const budgetPath = isAbsolute(this.options.budgetOutput) ? this.options.budgetOutput : join(this.root, this.options.budgetOutput);
      const budget = this.buildBudgetReport() || { version: VERSION, generatedAt: new Date().toISOString(), clientEntries: [] };
      writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`, 'utf8');
    }

    if (this.options.sarifOutput) {
      const sarifPath = isAbsolute(this.options.sarifOutput) ? this.options.sarifOutput : join(this.root, this.options.sarifOutput);
      writeFileSync(sarifPath, `${JSON.stringify(renderSarif(dedupeFindings(this.findings), this.root), null, 2)}\n`, 'utf8');
    }
  }

  hasNextDependency() {
    return this.packageIndex.some((entry) => Boolean(entry.directDeps?.next));
  }

  hasServerlessHint() {
    const rootPackage = this.readJson('package.json') || {};
    const text = JSON.stringify(rootPackage).toLowerCase();
    if (text.includes('vercel') || text.includes('cloudflare') || text.includes('netlify')) return true;
    return this.files.some((file) => /vercel\.json$|wrangler\.(toml|json)$|netlify\.toml$/.test(file));
  }

  detectReactVersionMajor() {
    for (const entry of this.packageIndex) {
      const major = parseMajor(entry.deps.react);
      if (major) return major;
    }
    return 0;
  }

  detectNextVersionMajor(value) {
    return parseMajor(value);
  }

  detectNextVersionMajorForFile(file) {
    let current = dirname(file);
    while (current.startsWith(this.root)) {
      const packagePath = join(current, 'package.json');
      if (existsSync(packagePath)) {
        const json = this.readJson(this.rel(packagePath));
        const deps = getDirectDeps(json || {});
        const major = parseMajor(deps.next);
        if (major) return major;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    for (const entry of this.packageIndex) {
      const major = parseMajor(entry.deps.next);
      if (major) return major;
    }
    return 0;
  }

  usesTypeScript() {
    return this.files.some((file) => ['.ts', '.tsx'].includes(extname(file)) || basename(file) === 'tsconfig.json');
  }

  strictish() {
    return this.options.profile === 'strict' || this.options.profile === 'ci' || this.options.strict;
  }

  readJson(relativePath) {
    if (this.jsonCache.has(relativePath)) return this.jsonCache.get(relativePath);
    const fullPath = join(this.root, relativePath);
    if (!existsSync(fullPath)) return null;
    const parsed = this.parseJson(this.readFile(fullPath), relativePath);
    this.jsonCache.set(relativePath, parsed);
    return parsed;
  }

  parseJson(raw, rel) {
    try {
      return JSON.parse(stripJsonComments(raw));
    } catch (error) {
      this.add({
        severity: 'critical',
        category: 'repository',
        rule: 'invalid-json',
        file: rel,
        message: `Invalid JSON: ${error.message}`,
        fix: 'Fix JSON syntax before relying on repository automation.',
      });
      return null;
    }
  }

  readFile(file) {
    const fullPath = isAbsolute(file) ? file : join(this.root, file);
    if (this.textCache.has(fullPath)) return this.textCache.get(fullPath);
    try {
      const content = readFileSync(fullPath, 'utf8');
      this.textCache.set(fullPath, content);
      return content;
    } catch {
      return '';
    }
  }

  rel(file) {
    return relative(this.root, file).replaceAll('\\', '/');
  }

  add(finding) {
    if (!finding?.rule) return;
    if (this.options.ignoreRules?.includes?.(finding.rule)) return;
    const override = this.options.ruleSeverities?.[finding.rule];
    const severity = normalizeSeverity(override || finding.severity || 'low');
    if (severity === 'off') return;
    this.findings.push({
      severity,
      category: finding.category || 'general',
      rule: finding.rule,
      file: finding.file,
      line: finding.line,
      column: finding.column,
      message: finding.message,
      fix: finding.fix,
      evidence: finding.evidence,
      autofix: finding.autofix,
    });
  }

  getVisibleFindings() {
    const min = SEVERITY_ORDER[this.options.minSeverity];
    return dedupeFindings(this.findings)
      .filter((finding) => (SEVERITY_ORDER[finding.severity] ?? -1) >= min)
      .sort((a, b) => {
        const severityDelta = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
        if (severityDelta !== 0) return severityDelta;
        return `${a.category}:${a.file || ''}:${a.rule}`.localeCompare(`${b.category}:${b.file || ''}:${b.rule}`);
      });
  }
}


class HyperdriveCodemodEngine {
  constructor({ root, options, findings, typeGraph, astGraph, packageIndex }) {
    this.root = root;
    this.options = options;
    this.findings = findings || [];
    this.typeGraph = typeGraph || null;
    this.astGraph = astGraph || null;
    this.packageIndex = packageIndex || [];
    this.ruleFilter = new Set((options.codemodRules || []).filter(Boolean));
    this.rejected = [];
    this.editsByFile = new Map();
  }

  run() {
    this.collectImportTypeEdits();
    this.collectMarkerEdits('server-module-missing-server-only-marker', 'server-only', 'server-only');
    this.collectMarkerEdits('browser-module-missing-client-boundary', 'client-only', 'client-only');
    this.collectWorkspaceDependencyEdits();
    this.collectTurboPipelineEdits();
    this.collectRootPrivateEdits();

    const plan = this.normalizePlan();
    const limitedPlan = plan.slice(0, this.options.codemodMaxEdits);
    if (plan.length > limitedPlan.length) {
      this.rejected.push({ reason: 'max-edits-exceeded', count: plan.length - limitedPlan.length, fix: 'Increase --codemod-max-edits or restrict with --codemod-rule.' });
    }

    const fileResults = this.applyOrPreview(limitedPlan);
    const summary = this.buildSummary(limitedPlan, fileResults);
    return {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      mode: this.options.codemodApply ? 'apply' : 'dry-run',
      root: this.root,
      summary,
      files: fileResults,
      rejected: this.rejected,
    };
  }

  enabled(rule) {
    return this.ruleFilter.size === 0 || this.ruleFilter.has(rule);
  }

  collectImportTypeEdits() {
    if (!this.enabled('import-type') || !this.typeGraph) return;
    for (const node of this.typeGraph.nodes.values()) {
      const opportunities = node.typeImportOpportunities || [];
      if (opportunities.length === 0) continue;
      const file = join(this.root, node.rel);
      const content = safeReadText(file);
      const lines = content.split(/\n/);
      for (const info of opportunities) {
        if (!info?.line || info.importedName === '*') continue;
        const lineIndex = info.line - 1;
        const originalLine = lines[lineIndex];
        if (!originalLine || !originalLine.includes(`'${info.specifier}'`) && !originalLine.includes(`"${info.specifier}"`)) continue;
        const replacementLine = promoteImportLineToType(originalLine, info);
        if (!replacementLine || replacementLine === originalLine) {
          this.rejected.push({ rule: 'import-type', file: node.rel, line: info.line, reason: 'unsupported-import-shape', localName: info.localName, specifier: info.specifier });
          continue;
        }
        const range = lineRange(content, lineIndex);
        this.addEdit(node.rel, {
          rule: 'import-type',
          title: `Convert ${info.localName} import to type-only usage`,
          confidence: 'high',
          start: range.start,
          end: range.end,
          replacement: replacementLine,
          before: originalLine,
          after: replacementLine,
          line: info.line,
        });
      }
    }
  }

  collectMarkerEdits(findingRule, markerSpecifier, codemodRule) {
    if (!this.enabled(codemodRule)) return;
    for (const finding of this.findings) {
      if (finding.rule !== findingRule || !finding.file) continue;
      const file = join(this.root, finding.file);
      const content = safeReadText(file);
      if (!content || hasRuntimeImport(content, markerSpecifier)) continue;
      const edit = createSideEffectImportEdit(content, markerSpecifier);
      if (!edit) {
        this.rejected.push({ rule: codemodRule, file: finding.file, reason: 'could-not-place-marker' });
        continue;
      }
      this.addEdit(finding.file, {
        rule: codemodRule,
        title: `Add import "${markerSpecifier}" boundary marker`,
        confidence: 'high',
        ...edit,
      });
    }
  }

  collectWorkspaceDependencyEdits() {
    if (!this.enabled('workspace-deps')) return;
    for (const finding of this.findings) {
      if (finding.rule !== 'workspace-import-not-declared' || !finding.message) continue;
      const match = finding.message.match(/imports workspace package\s+([^\s]+)\s+without/);
      const packageName = match?.[1];
      if (!packageName || !finding.file) continue;
      const owner = this.getOwningPackage(join(this.root, finding.file));
      if (!owner?.rel) continue;
      const packagePath = join(this.root, owner.rel);
      const raw = safeReadText(packagePath);
      const json = parseJsonSafe(raw);
      if (!json) continue;
      json.dependencies = json.dependencies || {};
      if (json.dependencies[packageName]) continue;
      json.dependencies[packageName] = 'workspace:*';
      const nextRaw = stablePackageJson(json);
      this.addEdit(owner.rel, {
        rule: 'workspace-deps',
        title: `Declare workspace dependency ${packageName}`,
        confidence: 'high',
        start: 0,
        end: raw.length,
        replacement: nextRaw,
        before: raw,
        after: nextRaw,
        line: 1,
      });
    }
  }

  collectTurboPipelineEdits() {
    if (!this.enabled('turbo-pipeline')) return;
    const rel = 'turbo.json';
    const file = join(this.root, rel);
    if (!existsSync(file)) return;
    const raw = safeReadText(file);
    const json = parseJsonSafe(stripJsonComments(raw));
    if (!json || !Object.hasOwn(json, 'pipeline') || Object.hasOwn(json, 'tasks')) return;
    json.tasks = json.pipeline;
    delete json.pipeline;
    const nextRaw = `${JSON.stringify(json, null, 2)}\n`;
    this.addEdit(rel, {
      rule: 'turbo-pipeline',
      title: 'Rename turbo.json pipeline to tasks',
      confidence: 'high',
      start: 0,
      end: raw.length,
      replacement: nextRaw,
      before: raw,
      after: nextRaw,
      line: 1,
    });
  }

  collectRootPrivateEdits() {
    if (!this.enabled('root-private')) return;
    const rel = 'package.json';
    const file = join(this.root, rel);
    if (!existsSync(file)) return;
    const raw = safeReadText(file);
    const json = parseJsonSafe(raw);
    if (!json || json.private === true) return;
    json.private = true;
    const nextRaw = stablePackageJson(json);
    this.addEdit(rel, {
      rule: 'root-private',
      title: 'Mark monorepo root package as private',
      confidence: 'high',
      start: 0,
      end: raw.length,
      replacement: nextRaw,
      before: raw,
      after: nextRaw,
      line: 1,
    });
  }

  addEdit(rel, edit) {
    if (!APP_SOURCE_EXTENSIONS.has(extname(rel)) && !['package.json', 'turbo.json'].includes(basename(rel))) {
      this.rejected.push({ rule: edit.rule, file: rel, reason: 'unsupported-file-extension' });
      return;
    }
    const edits = this.editsByFile.get(rel) || [];
    edits.push({ ...edit, file: rel });
    this.editsByFile.set(rel, edits);
  }

  normalizePlan() {
    const plan = [];
    for (const [rel, edits] of this.editsByFile.entries()) {
      const sorted = edits.sort((a, b) => a.start - b.start || a.end - b.end);
      let lastEnd = -1;
      const unique = new Set();
      for (const edit of sorted) {
        const key = `${edit.start}:${edit.end}:${edit.replacement}`;
        if (unique.has(key)) continue;
        unique.add(key);
        if (edit.start < lastEnd) {
          this.rejected.push({ rule: edit.rule, file: rel, line: edit.line, reason: 'overlapping-edit' });
          continue;
        }
        lastEnd = edit.end;
        plan.push(edit);
      }
    }
    return plan.sort((a, b) => a.file.localeCompare(b.file) || a.start - b.start);
  }

  applyOrPreview(plan) {
    const grouped = groupBy(plan, (edit) => edit.file);
    const results = [];
    const backupRoot = join(this.root, this.options.codemodBackupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const [rel, edits] of grouped.entries()) {
      const file = join(this.root, rel);
      const before = safeReadText(file);
      const after = applyEdits(before, edits);
      const changed = before !== after;
      let backupFile = null;
      if (changed && this.options.codemodApply) {
        if (this.options.codemodBackup) {
          backupFile = join(backupRoot, timestamp, rel);
          mkdirSync(dirname(backupFile), { recursive: true });
          copyFileSync(file, backupFile);
        }
        writeFileSync(file, after, 'utf8');
      }
      results.push({
        file: rel,
        changed,
        applied: Boolean(changed && this.options.codemodApply),
        backupFile: backupFile ? relative(this.root, backupFile).replaceAll('\\', '/') : null,
        edits: edits.map((edit) => ({ rule: edit.rule, title: edit.title, confidence: edit.confidence, line: edit.line, before: edit.before, after: edit.after })),
        patch: renderEditPatch(rel, before, after, edits),
      });
    }
    return results;
  }

  buildSummary(plan, fileResults) {
    const changedFiles = fileResults.filter((item) => item.changed);
    return {
      candidates: plan.length,
      filesChanged: changedFiles.length,
      applied: this.options.codemodApply ? changedFiles.reduce((sum, item) => sum + item.edits.length, 0) : 0,
      dryRunEdits: this.options.codemodApply ? 0 : changedFiles.reduce((sum, item) => sum + item.edits.length, 0),
      rejected: this.rejected.length,
      backupsEnabled: Boolean(this.options.codemodApply && this.options.codemodBackup),
    };
  }

  getOwningPackage(file) {
    const normalized = normalizeFileName(file);
    let best = null;
    for (const pkg of this.packageIndex) {
      const dir = normalizeFileName(pkg.dir);
      if (normalized === dir || normalized.startsWith(`${dir}/`)) {
        if (!best || dir.length > normalizeFileName(best.dir).length) best = pkg;
      }
    }
    return best;
  }
}


function normalizeFileName(file) {
  return String(file || '').replaceAll('\\', '/');
}

function getModuleSpecifierText(ts, importDecl) {
  if (importDecl?.moduleSpecifier && ts.isStringLiteral(importDecl.moduleSpecifier)) return importDecl.moduleSpecifier.text;
  return null;
}

function hasModifier(ts, node, modifierName) {
  const kind = modifierName === 'export' ? ts.SyntaxKind.ExportKeyword : ts.SyntaxKind.DefaultKeyword;
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === kind));
}

function isIdentifierBindingInImport(ts, node) {
  let current = node.parent;
  while (current) {
    if (ts.isImportDeclaration(current) || ts.isImportClause?.(current) || ts.isImportSpecifier?.(current) || ts.isNamespaceImport?.(current)) return true;
    if (ts.isSourceFile(current)) return false;
    current = current.parent;
  }
  return false;
}

function isIdentifierInTypePosition(ts, node) {
  let current = node;
  let parent = node.parent;
  while (parent && (ts.isQualifiedName?.(parent) || ts.isPropertyAccessExpression?.(parent))) {
    current = parent;
    parent = parent.parent;
  }
  if (!parent) return false;
  if (ts.isJsxOpeningElement?.(parent) || ts.isJsxSelfClosingElement?.(parent) || ts.isJsxClosingElement?.(parent)) return false;
  if (ts.isTypeQueryNode?.(parent)) return true;
  if (ts.isTypeReferenceNode?.(parent) || ts.isExpressionWithTypeArguments?.(parent) || ts.isImportTypeNode?.(parent)) return true;
  if (ts.isTypeAliasDeclaration?.(parent) || ts.isInterfaceDeclaration?.(parent)) return true;
  if (ts.isHeritageClause?.(parent)) return parent.parent && ts.isInterfaceDeclaration?.(parent.parent);
  if (ts.isAsExpression?.(parent) && parent.type === current) return true;
  if (ts.isTypeAssertionExpression?.(parent) && parent.type === current) return true;
  if (ts.isParameter?.(parent) && parent.type === current) return true;
  if (ts.isPropertySignature?.(parent) || ts.isMethodSignature?.(parent)) return true;
  if (ts.isVariableDeclaration?.(parent) && parent.type === current) return true;
  if (ts.isFunctionDeclaration?.(parent) || ts.isFunctionExpression?.(parent) || ts.isArrowFunction?.(parent)) return parent.type === current;
  return false;
}

function isPrimitiveLikeType(ts, type) {
  const flags = type.flags || 0;
  return Boolean(
    flags & ts.TypeFlags.StringLike ||
    flags & ts.TypeFlags.NumberLike ||
    flags & ts.TypeFlags.BooleanLike ||
    flags & ts.TypeFlags.BigIntLike ||
    flags & ts.TypeFlags.Null ||
    flags & ts.TypeFlags.Undefined ||
    flags & ts.TypeFlags.Void ||
    flags & ts.TypeFlags.Never ||
    flags & ts.TypeFlags.Literal ||
    flags & ts.TypeFlags.TemplateLiteral
  );
}

function dedupeSerializableIssues(issues) {
  const seen = new Set();
  const output = [];
  for (const issue of issues) {
    const key = `${issue.propPath}:${issue.reason}:${issue.typeText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(issue);
  }
  return output;
}

function flattenTsDiagnostic(ts, messageText) {
  return ts.flattenDiagnosticMessageText ? ts.flattenDiagnosticMessageText(messageText, ' ') : String(messageText);
}

function isBuiltinSpecifier(specifier) {
  return /^node:/.test(specifier) || [
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'crypto', 'dns', 'events', 'fs', 'http', 'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'querystring', 'readline', 'stream', 'string_decoder', 'tls', 'tty', 'url', 'util', 'vm', 'worker_threads', 'zlib',
  ].includes(specifier);
}

function hasUseDirective(content, directive) {
  const head = content.slice(0, 600);
  return new RegExp(`^[\\s;]*(?:['\"]use ${directive}['\"];?)`, 'm').test(head);
}

function parseMajor(version) {
  if (!version) return 0;
  const match = String(version).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getDirectDeps(json = {}) {
  return {
    ...(json.dependencies || {}),
    ...(json.devDependencies || {}),
    ...(json.optionalDependencies || {}),
  };
}

function getAllDeps(json = {}) {
  return {
    ...getDirectDeps(json),
    ...(json.peerDependencies || {}),
  };
}

function mergePackageDeps(depObjects) {
  const merged = {};
  for (const deps of depObjects) {
    for (const [name, version] of Object.entries(deps || {})) {
      if (!merged[name]) merged[name] = version;
    }
  }
  return merged;
}

function hasAnyDep(deps, names) {
  return names.some((name) => Boolean(deps[name]));
}

function hasEnv(envSet, key) {
  if (envSet.has(key)) return true;
  for (const value of envSet) {
    if (String(value).endsWith('*') && key.startsWith(String(value).slice(0, -1))) return true;
  }
  return false;
}

function hasAuthCheck(content) {
  return /\b(auth|currentUser|getServerSession|getSession|session|requireUser|requireAuth|hasPermission|can\(|authorize|ability|policy|verifyAuth|clerkClient|supabase\.auth)\b/.test(content);
}

function importRegex(importName) {
  const escaped = escapeRegExp(importName);
  return new RegExp(`(?:from\\s+['\"]${escaped}['\"]|import\\s*\\(\\s*['\"]${escaped}['\"]\\s*\\)|require\\(\\s*['\"]${escaped}['\"]\\s*\\))`);
}


function hasRuntimeImport(content, importName) {
  const escaped = escapeRegExp(importName);
  const runtimeImport = new RegExp(`import\\s+(?!type\\b)[\\s\\S]{0,240}from\\s+['"]${escaped}['"]`);
  const sideEffectImport = new RegExp(`import\\s+['"]${escaped}['"]`);
  const dynamicImport = new RegExp(`import\\s*\\(\\s*['"]${escaped}['"]\\s*\\)`);
  const requireImport = new RegExp(`require\\(\\s*['"]${escaped}['"]\\s*\\)`);
  return runtimeImport.test(content) || sideEffectImport.test(content) || dynamicImport.test(content) || requireImport.test(content);
}

function findRelationScalarFields(schema) {
  const fields = new Set();
  const relationMatches = schema.matchAll(/@relation\s*\([^)]*fields\s*:\s*\[([^\]]+)]/g);
  for (const match of relationMatches) {
    const names = match[1]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    for (const name of names) fields.add(name);
  }
  return fields;
}

function fieldHasIndex(schema, fieldName) {
  const escaped = escapeRegExp(fieldName);
  const fieldLine = new RegExp(`^\\s*${escaped}\\s+[^\\n]+(@id|@unique)`, 'm');
  if (fieldLine.test(schema)) return true;

  const indexPattern = new RegExp(`@@(index|unique|id)\\s*\\(\\s*\\[[^\\]]*\\b${escaped}\\b[^\\]]*]`, 'm');
  return indexPattern.test(schema);
}


function getPackageSpecifierName(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || isBuiltinSpecifier(specifier)) return null;
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return scope && name ? `${scope}/${name}` : specifier;
  }
  return specifier.split('/')[0];
}

function readExportedConstString(content, name) {
  const pattern = new RegExp(`export\\s+const\\s+${escapeRegExp(name)}\\s*=\\s*['"]([^'"]+)['"]`);
  const match = String(content).match(pattern);
  return match ? match[1] : null;
}

function readExportedConstLiteral(content, name) {
  const pattern = new RegExp(`export\\s+const\\s+${escapeRegExp(name)}\\s*=\\s*([^;\\n]+)`);
  const match = String(content).match(pattern);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripJsonComments(raw) {
  return String(raw)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function dedupeFindings(findings) {
  const seen = new Set();
  const output = [];
  for (const finding of findings) {
    const key = `${finding.severity}:${finding.category}:${finding.rule}:${finding.file || ''}:${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }
  return output;
}


function safeReadText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stablePackageJson(json) {
  const ordered = {};
  const preferred = ['name', 'version', 'private', 'description', 'type', 'bin', 'main', 'exports', 'files', 'scripts', 'dependencies', 'devDependencies', 'peerDependencies', 'peerDependenciesMeta', 'optionalDependencies', 'engines', 'packageManager', 'workspaces'];
  for (const key of preferred) {
    if (Object.hasOwn(json, key)) ordered[key] = sortJsonObject(json[key]);
  }
  for (const key of Object.keys(json).sort()) {
    if (!Object.hasOwn(ordered, key)) ordered[key] = sortJsonObject(json[key]);
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

function sortJsonObject(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return value;
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = sortJsonObject(value[key]);
  return sorted;
}

function lineRange(content, zeroBasedLineIndex) {
  let start = 0;
  for (let index = 0; index < zeroBasedLineIndex; index += 1) {
    const next = content.indexOf('\n', start);
    if (next === -1) return { start: content.length, end: content.length };
    start = next + 1;
  }
  const lineEnd = content.indexOf('\n', start);
  return { start, end: lineEnd === -1 ? content.length : lineEnd };
}

function promoteImportLineToType(line, info) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('import ') || trimmed.startsWith('import type ')) return null;
  const specifierPattern = new RegExp(`from\\s+(['\"])${escapeRegExp(info.specifier)}\\1`);
  if (!specifierPattern.test(line)) return null;

  if (info.importedName === 'default') {
    const defaultOnly = new RegExp(`^(\\s*)import\\s+${escapeRegExp(info.localName)}\\s+from\\s+(['\"])${escapeRegExp(info.specifier)}\\2(.*)$`);
    if (defaultOnly.test(line)) return line.replace(defaultOnly, `$1import type ${info.localName} from $2${info.specifier}$2$3`);
    return null;
  }

  const namedStart = line.indexOf('{');
  const namedEnd = line.indexOf('}', namedStart + 1);
  if (namedStart === -1 || namedEnd === -1) return null;
  const before = line.slice(0, namedStart + 1);
  const body = line.slice(namedStart + 1, namedEnd);
  const after = line.slice(namedEnd);
  const parts = splitCommaSeparatedImportSpecifiers(body);
  let changed = false;
  const nextParts = parts.map((part) => {
    const trimmedPart = part.trim();
    if (!trimmedPart || /^type\s+/.test(trimmedPart)) return part;
    const localMatch = trimmedPart.match(/(?:^|\s+as\s+)([A-Za-z_$][\w$]*)$/);
    const localName = localMatch?.[1];
    if (localName !== info.localName) return part;
    changed = true;
    return part.replace(/^(\s*)/, '$1type ');
  });
  if (!changed) return null;
  return `${before}${nextParts.join(',')}${after}`;
}

function splitCommaSeparatedImportSpecifiers(value) {
  const output = [];
  let current = '';
  let depth = 0;
  for (const char of value) {
    if (char === '<' || char === '(' || char === '[' || char === '{') depth += 1;
    if (char === '>' || char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      output.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) output.push(current);
  return output;
}

function createSideEffectImportEdit(content, specifier) {
  if (content.includes(`import "${specifier}"`) || content.includes(`import '${specifier}'`)) return null;
  const lines = content.split(/\n/);
  let insertLine = 0;
  while (insertLine < lines.length && /^\s*(['\"]use (client|server|cache)['\"];?|\/\/|\/\*)/.test(lines[insertLine])) insertLine += 1;
  while (insertLine < lines.length && /^\s*$/.test(lines[insertLine])) insertLine += 1;
  let start = 0;
  for (let index = 0; index < insertLine; index += 1) start += lines[index].length + 1;
  const replacement = `import "${specifier}";\n`;
  return {
    start,
    end: start,
    replacement,
    before: '',
    after: replacement.trim(),
    line: insertLine + 1,
  };
}

function applyEdits(content, edits) {
  let output = content;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    output = `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`;
  }
  return output;
}

function renderEditPatch(rel, before, after, edits) {
  if (before === after) return '';
  const lines = [`diff --hyperdrive a/${rel} b/${rel}`, `--- a/${rel}`, `+++ b/${rel}`];
  for (const edit of edits) {
    lines.push(`@@ ${edit.rule}:${edit.line || 1} ${edit.title || ''}`.trim());
    if (edit.before) lines.push(`- ${singleLinePreview(edit.before)}`);
    if (edit.after) lines.push(`+ ${singleLinePreview(edit.after)}`);
  }
  return `${lines.join('\n')}\n`;
}

function singleLinePreview(value) {
  return String(value).replace(/\n/g, '\\n').slice(0, 500);
}

function renderPretty(findings, root) {
  if (findings.length === 0) {
    return `${ANSI.green}${ANSI.bold}Hyperdrive Audit: PASS${ANSI.reset}\nNo findings at the selected threshold.\n`;
  }

  const lines = [];
  lines.push(`${ANSI.bold}Hyperdrive Audit v${VERSION}${ANSI.reset}`);
  lines.push(`${ANSI.dim}${root}${ANSI.reset}`);
  lines.push('');

  const groups = groupBy(findings, (finding) => finding.severity);
  for (const severity of ['critical', 'high', 'medium', 'low', 'info']) {
    const items = groups.get(severity) || [];
    if (items.length === 0) continue;
    const color = severity === 'critical' ? ANSI.red : severity === 'high' ? ANSI.yellow : severity === 'medium' ? ANSI.cyan : ANSI.gray;
    lines.push(`${color}${severity.toUpperCase()} (${items.length})${ANSI.reset}`);
    for (const item of items) {
      const loc = item.file ? `${item.file}${item.line ? `:${item.line}${item.column ? `:${item.column}` : ''}` : ''}` : '';
      lines.push(`  - [${item.category}/${item.rule}] ${item.message}`);
      if (loc) lines.push(`    ${ANSI.dim}${loc}${ANSI.reset}`);
      if (item.evidence) lines.push(`    ${ANSI.dim}Evidence:${ANSI.reset} ${singleLinePreview(item.evidence)}`);
      if (item.fix) lines.push(`    ${ANSI.green}Fix:${ANSI.reset} ${item.fix}`);
      if (item.autofix?.title) lines.push(`    ${ANSI.cyan}Autofix suggestion:${ANSI.reset} ${item.autofix.title} (${item.autofix.kind || 'suggestion'}, confidence: ${item.autofix.confidence || 'unknown'})`);
    }
    lines.push('');
  }

  lines.push(summarize(findings));
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(findings, root, meta = {}) {
  const lines = [];
  lines.push('# Hyperdrive Audit Report');
  lines.push('');
  lines.push(`Root: \`${root}\``);
  lines.push(`Version: \`${VERSION}\``);
  lines.push(`Generated: \`${new Date().toISOString()}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|---|---:|');
  const counts = countBySeverity(findings);
  for (const severity of ['critical', 'high', 'medium', 'low', 'info']) lines.push(`| ${severity} | ${counts[severity] || 0} |`);
  lines.push('');
  lines.push(summarize(findings));
  lines.push('');

  if (findings.length === 0) {
    lines.push('No findings at the selected threshold.');
    return `${lines.join('\n')}\n`;
  }

  lines.push('## Top 10 highest-risk findings');
  lines.push('');
  for (const item of findings.slice(0, 10)) {
    const loc = item.file ? `${item.file}${item.line ? `:${item.line}${item.column ? `:${item.column}` : ''}` : ''}` : 'repository';
    lines.push(`- **${item.severity.toUpperCase()}** \`${item.category}/${item.rule}\` at \`${loc}\`: ${item.message}`);
  }
  lines.push('');

  const groups = groupBy(findings, (finding) => finding.category || 'general');
  lines.push('## Findings by category');
  lines.push('');
  for (const [category, items] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${category} (${items.length})`);
    lines.push('');
    for (const item of items) {
      const loc = item.file ? `${item.file}${item.line ? `:${item.line}${item.column ? `:${item.column}` : ''}` : ''}` : 'repository';
      lines.push(`#### ${item.rule}`);
      lines.push('');
      lines.push(`- Severity: **${item.severity}**`);
      lines.push(`- Location: \`${loc}\``);
      lines.push(`- Message: ${item.message}`);
      if (item.evidence) lines.push(`- Evidence: \`${singleLinePreview(item.evidence)}\``);
      if (item.fix) lines.push(`- Fix: ${item.fix}`);
      if (item.autofix?.steps?.length) {
        lines.push('- Suggested steps:');
        for (const step of item.autofix.steps) lines.push(`  - ${step}`);
      }
      lines.push('');
    }
  }

  if (Array.isArray(meta.recommendations) && meta.recommendations.length > 0) {
    lines.push('## Recommended next steps');
    lines.push('');
    for (const item of meta.recommendations) {
      lines.push(`- **${item.title}**`);
      if (item.command) lines.push(`  - Command: \`${item.command}\``);
      if (item.reason) lines.push(`  - Reason: ${item.reason}`);
    }
    lines.push('');
  }

  if (Array.isArray(meta.artifacts) && meta.artifacts.length > 0) {
    lines.push('## Machine-readable artifacts');
    lines.push('');
    for (const artifact of meta.artifacts) lines.push(`- \`${artifact}\``);
    lines.push('');
  }
  if (meta.failureReason) {
    lines.push('## CI failure reason');
    lines.push('');
    lines.push(meta.failureReason);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderJson(findings, root, meta = {}) {
  return `${JSON.stringify({
    version: VERSION,
    root,
    generatedAt: new Date().toISOString(),
    summary: countBySeverity(findings),
    findings,
    artifacts: meta.artifacts || [],
    recommendations: meta.recommendations || [],
    rules: meta.rules || [],
    config: meta.config || {},
    timings: meta.timings || {},
  }, null, 2)}\n`;
}


function renderSarif(findings, root) {
  const rules = new Map();
  for (const finding of findings) {
    const id = `${finding.category}/${finding.rule}`;
    if (!rules.has(id)) {
      rules.set(id, {
        id,
        name: id,
        shortDescription: { text: id },
        fullDescription: { text: finding.fix || finding.message },
        defaultConfiguration: { level: sarifLevel(finding.severity) },
        help: { text: finding.fix || finding.message },
      });
    }
  }
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: { driver: { name: 'Hyperdrive Auditor', semanticVersion: VERSION, rules: [...rules.values()] } },
        results: findings.map((finding) => ({
          ruleId: `${finding.category}/${finding.rule}`,
          level: sarifLevel(finding.severity),
          message: { text: finding.message },
          locations: finding.file ? [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.file },
                region: { startLine: finding.line || finding.autofix?.line || 1, startColumn: finding.column || 1 },
              },
            },
          ] : [],
          properties: {
            partialFingerprints: { primaryLocationLineHash: `${finding.rule}:${finding.file || 'repo'}:${finding.message}` },
            severity: finding.severity,
            category: finding.category,
            fix: finding.fix,
            autofix: finding.autofix || undefined,
          },
        })),
      },
    ],
  };
}

function sarifLevel(severity) {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'note';
}

function groupBy(items, selector) {
  const map = new Map();
  for (const item of items) {
    const key = selector(item);
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  counts.total = findings.length;
  return counts;
}

function summarize(findings) {
  const counts = countBySeverity(findings);
  return `Summary: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info.`;
}

function shouldFail(findings, failOn) {
  if (failOn === 'never') return false;
  const threshold = SEVERITY_ORDER[failOn];
  return findings.some((finding) => SEVERITY_ORDER[finding.severity] >= threshold);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.version) {
    console.log(VERSION);
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }

  const auditor = new HyperdriveAuditor(options);
  const findings = auditor.run();

  let output;
  if (options.format === 'json') output = renderJson(findings, auditor.root);
  else if (options.format === 'markdown') output = renderMarkdown(findings, auditor.root);
  else output = renderPretty(findings, auditor.root);

  if (options.output) {
    const outputPath = isAbsolute(options.output) ? options.output : join(auditor.root, options.output);
    writeFileSync(outputPath, output, 'utf8');
    console.log(`Hyperdrive audit report written to ${outputPath}`);
  } else {
    process.stdout.write(output);
  }

  if (shouldFail(findings, options.failOn)) {
    process.exitCode = 1;
  }
}

export { VERSION, SEVERITY_ORDER, HyperdriveAuditor, HyperdriveCodemodEngine, parseArgs, printHelp, renderPretty, renderMarkdown, renderJson, renderSarif, shouldFail, normalizeSeverity, countBySeverity, summarize, dedupeFindings };
