import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'src');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

const hookLine = /^\s*const styles = useMemo\(\(\) => createStyles\(colors\), \[colors\]\);\n/gm;

for (const filePath of walk(src)) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.includes('function createStyles(colors: AppColors)')) continue;
  const next = text.replace(hookLine, '');
  if (next !== text) {
    fs.writeFileSync(filePath, next);
    console.log('cleaned', path.relative(root, filePath));
  }
}
