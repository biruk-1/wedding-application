#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlFile = path.join(root, 'supabase', 'tests', 'security_foundation.sql');
const dbUrl =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const psql = spawnSync(
  'psql',
  [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlFile],
  { stdio: 'inherit', shell: true }
);

if (psql.error) {
  console.error('psql failed to start:', psql.error.message);
  console.error('Install PostgreSQL client tools or set SUPABASE_DB_URL.');
  process.exit(1);
}
process.exit(psql.status ?? 1);
