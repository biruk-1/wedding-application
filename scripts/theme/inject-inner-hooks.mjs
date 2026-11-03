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

const fnStart =
  /(?:export (?:default )?)?function (\w+)\([^)]*\)\s*\{/g;

for (const filePath of walk(src)) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes('function createStyles(colors: AppColors)')) continue;

  let changed = false;
  const matches = [...text.matchAll(fnStart)];
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const m = matches[i];
    const name = m[1];
    if (name === 'createStyles') continue;

    const start = m.index + m[0].length;
    const nextFn = matches[i + 1]?.index ?? text.length;
    const body = text.slice(start, nextFn);

    const needsStyles = /\bstyles\./.test(body);
    const needsColors = /\bcolors\./.test(body);
    if (!needsStyles && !needsColors) continue;
    if (body.includes('const colors = useColors()')) continue;

    let inject = '';
    if (needsColors || needsStyles) inject += '  const colors = useColors();\n';
    if (needsStyles) inject += '  const styles = useMemo(() => createStyles(colors), [colors]);\n';

    text = text.slice(0, start) + '\n' + inject + text.slice(start);
    changed = true;
  }

  if (changed) {
    if (!text.includes("import { useColors }")) {
      text = `import { useColors } from '@/theme/WeddingThemeContext';\n${text}`;
    }
    if (text.includes('useMemo') && !text.includes("import { useMemo")) {
      text = `import { useMemo } from 'react';\n${text}`;
    }
    fs.writeFileSync(filePath, text);
    console.log('injected', path.relative(root, filePath));
  }
}
