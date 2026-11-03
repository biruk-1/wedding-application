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
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

for (const filePath of walk(src)) {
  if (filePath.includes(`${path.sep}theme${path.sep}`) && !filePath.endsWith('.test.ts')) continue;

  let text = fs.readFileSync(filePath, 'utf8');
  const usesUseColors = /\buseColors\s*\(/.test(text);
  const usesUseMemo = /\buseMemo\s*\(/.test(text);
  const usesAppColors = /\bAppColors\b/.test(text);
  if (!usesUseColors && !usesAppColors) continue;

  text = text.replace(
    /import\s*\{\s*colors(?:\s*,\s*type\s+ColorToken)?\s*\}\s*from\s*'@\/theme\/colors';?\n/g,
    '',
  );
  text = text.replace(
    /import\s*\{\s*type\s+ColorToken\s*,\s*colors\s*\}\s*from\s*'@\/theme\/colors';?\n/g,
    '',
  );

  if (usesUseColors && !text.includes("from '@/theme/WeddingThemeContext'")) {
    text = `import { useColors } from '@/theme/WeddingThemeContext';\n${text}`;
  }
  if (usesUseMemo && !text.includes("from 'react'") && !text.includes('from "react"')) {
    text = `import { useMemo } from 'react';\n${text}`;
  } else if (usesUseMemo && /import \{([^}]+)\} from 'react'/.test(text)) {
    text = text.replace(/import \{([^}]+)\} from 'react';/, (m, inner) => {
      if (inner.includes('useMemo')) return m;
      return `import { useMemo, ${inner.trim()} } from 'react';`;
    });
  }
  if (usesAppColors && !text.includes("from '@/theme/types'")) {
    text = `import type { AppColors } from '@/theme/types';\n${text}`;
  }

  text = text.replace(
    /import \{ useMemo \} from 'react';\nimport \{ useMemo \} from 'react';\n/g,
    "import { useMemo } from 'react';\n",
  );
  text = text.replace(
    /import \{ useColors \} from '@\/theme\/WeddingThemeContext';\nimport \{ useColors \} from '@\/theme\/WeddingThemeContext';\n/g,
    "import { useColors } from '@/theme/WeddingThemeContext';\n",
  );

  fs.writeFileSync(filePath, text);
}

console.log('imports fixed');
