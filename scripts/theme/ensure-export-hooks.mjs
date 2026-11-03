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

for (const filePath of walk(src)) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes('function createStyles(colors: AppColors)')) continue;

  const factory = text.match(/function (create\w*Styles)\(colors: AppColors\)/)?.[1] ?? 'createStyles';
  let changed = false;

  const patterns = [
    /export function (\w+)\([^)]*\)\s*\{/g,
    /export const (\w+) = memo\(function (\w+)\([^)]*\)\s*\{/g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index + m[0].length;
      const slice = text.slice(start, start + 400);
      if (!/\bstyles\./.test(text.slice(start, start + 8000))) continue;
      if (/const colors = useColors\(\)/.test(slice)) continue;

      const inject = `\n  const colors = useColors();\n  const styles = useMemo(() => ${factory}(colors), [colors]);\n`;
      text = text.slice(0, start) + inject + text.slice(start);
      changed = true;
      re.lastIndex = start + inject.length;
    }
  }

  text = text.replace(/import \{ useMemo \} from 'react';\nimport \{ useMemo \} from 'react';\n/g, "import { useMemo } from 'react';\n");
  text = text.replace(/import \{ useMemo, useMemo,/g, 'import { useMemo,');

  if (!text.includes("import { useColors }")) {
    text = `import { useColors } from '@/theme/WeddingThemeContext';\n${text}`;
    changed = true;
  }
  if (text.includes('useMemo(') && !/import \{[^}]*useMemo/.test(text)) {
    text = text.replace(/^import \{([^}]+)\} from 'react';/m, (line) => {
      if (line.includes('useMemo')) return line;
      return line.replace('import {', 'import { useMemo, ');
    });
    if (!/import \{[^}]*useMemo/.test(text)) {
      text = `import { useMemo } from 'react';\n${text}`;
    }
    changed = true;
  }
  if (text.includes('AppColors') && !text.includes("from '@/theme/types'")) {
    text = `import type { AppColors } from '@/theme/types';\n${text}`;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, text);
    console.log('export hooks', path.relative(root, filePath));
  }
}
