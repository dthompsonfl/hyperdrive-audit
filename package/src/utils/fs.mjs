import { existsSync, readFileSync } from 'node:fs'; export function readText(path) { return existsSync(path) ? readFileSync(path, 'utf8') : ''; }
