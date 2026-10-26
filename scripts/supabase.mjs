#!/usr/bin/env node
/**
 * Windows-friendly Supabase CLI launcher.
 * Prefers an allowlisted copy under %LOCALAPPDATA%\kiburan\bin when
 * Application Control blocks the binary inside node_modules.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const ext = process.platform === 'win32' ? '.exe' : '';
const args = process.argv.slice(2);

function packageBin(name) {
  try {
    const pkg = path.dirname(require.resolve('@supabase/cli-windows-x64/package.json'));
    return path.join(pkg, 'bin', `${name}${ext}`);
  } catch {
    return null;
  }
}

function ensureLocalCopy() {
  const src = packageBin('supabase');
  if (!src || !fs.existsSync(src)) return null;
  const destDir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
    'kiburan',
    'bin'
  );
  const dest = path.join(destDir, `supabase${ext}`);
  try {
    fs.mkdirSync(destDir, { recursive: true });
    const srcStat = fs.statSync(src);
    let needsCopy = !fs.existsSync(dest);
    if (!needsCopy) {
      const destStat = fs.statSync(dest);
      needsCopy = destStat.size !== srcStat.size;
    }
    if (needsCopy) fs.copyFileSync(src, dest);
    return dest;
  } catch {
    return null;
  }
}

function canRun(binPath) {
  if (!binPath || !fs.existsSync(binPath)) return false;
  const probe = spawnSync(binPath, ['--version'], { encoding: 'utf8' });
  return !probe.error && probe.status === 0;
}

const candidates = [
  process.env.SUPABASE_CLI_BINARY_OVERRIDE,
  ensureLocalCopy(),
  packageBin('supabase'),
  packageBin('supabase-go'),
].filter(Boolean);

const binPath = candidates.find(canRun);
if (!binPath) {
  console.error('No runnable Supabase CLI binary found.');
  console.error('Allowlist supabase.exe or set SUPABASE_CLI_BINARY_OVERRIDE.');
  process.exit(1);
}

const result = spawnSync(binPath, args, { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
