#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlFiles = [
  'security_foundation.sql',
  'planning_team_security.sql',
  'planning_team_membership.sql',
  'planning_team_invites.sql',
  'planning_team_permissions.sql',
  'planning_team_guests.sql',
].map((name) => path.join(root, 'supabase', 'tests', name));
const dbUrl =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

for (const sqlFile of sqlFiles) {
  const psql = spawnSync(
    'psql',
    [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlFile],
    { stdio: 'inherit' }
  );

  if (psql.error) {
    console.error('psql failed to start:', psql.error.message);
    console.error('Install PostgreSQL client tools or set SUPABASE_DB_URL.');
    process.exit(1);
  }
  if (psql.status !== 0) {
    process.exit(psql.status ?? 1);
  }
}
