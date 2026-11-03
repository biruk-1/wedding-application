import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'src');

function walk2(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk2(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

for (const filePath of walk2(src)) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes('function createStyles(colors: AppColors)')) continue;
  if (/\}\);\s*\}\s*$/.test(text)) continue;
  if (text.trimEnd().endsWith('});')) {
    text = text.trimEnd().replace(/\}\);$/, '  });\n}\n');
    fs.writeFileSync(filePath, text);
    console.log('fixed', path.relative(root, filePath));
  }
}
