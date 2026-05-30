#!/usr/bin/env node
import { runCli } from '../src/cli/run.mjs';

try {
  const result = await runCli(process.argv.slice(2));
  process.exitCode = result?.exitCode ?? 0;
} catch (error) {
  console.error(`Hyperdrive Auditor failed: ${error?.message || error}`);
  process.exitCode = 2;
}
