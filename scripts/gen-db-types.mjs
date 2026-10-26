#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'src', 'types', 'database.types.ts');
const launcher = path.join(root, 'scripts', 'supabase.mjs');

const result = spawnSync(process.execPath, [launcher, 'gen', 'types', 'typescript', '--local'], {
  encoding: 'utf8',
  cwd: root,
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'gen types failed\n');
  process.exit(result.status ?? 1);
}

const types = result.stdout;
if (!types.includes('export type Database')) {
  process.stderr.write('Generated output did not look like database types.\n');
  process.stderr.write(types.slice(0, 500));
  process.exit(1);
}

fs.writeFileSync(outFile, types, 'utf8');
process.stdout.write(`Wrote ${outFile}\n`);
