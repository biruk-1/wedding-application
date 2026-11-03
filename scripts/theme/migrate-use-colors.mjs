/**
 * One-off helper: migrate `import { colors } from '@/theme/colors'` screens to useColors + createStyles.
 * Skips files already using useColors.
 */
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

function migrateFile(filePath) {
  let srcText = fs.readFileSync(filePath, 'utf8');
  if (!srcText.includes("@/theme/colors")) return false;
  if (srcText.includes('useColors')) return false;
  if (filePath.includes('theme\\') || filePath.includes('theme/')) return false;

  const usesColorsInStyles = /StyleSheet\.create\([\s\S]*?colors\./.test(srcText);
  const usesColorsInline = /\bcolors\./.test(srcText);

  if (!usesColorsInline) return false;

  srcText = srcText.replace(
    /import\s*\{\s*colors(?:\s*,\s*type\s+ColorToken)?\s*\}\s*from\s*'@\/theme\/colors';?\n/g,
    "import { useMemo } from 'react';\n\nimport { useColors } from '@/theme/WeddingThemeContext';\nimport type { AppColors } from '@/theme/types';\n",
  );
  srcText = srcText.replace(
    /import\s*\{\s*type\s+ColorToken\s*,\s*colors\s*\}\s*from\s*'@\/theme\/colors';?\n/g,
    "import { useMemo } from 'react';\n\nimport { useColors } from '@/theme/WeddingThemeContext';\nimport type { AppColors } from '@/theme/types';\n",
  );

  if (usesColorsInStyles) {
    srcText = srcText.replace(
      /const styles = StyleSheet\.create\(\{/g,
      'function createStyles(colors: AppColors) {\n  return StyleSheet.create({',
    );
    srcText = srcText.replace(/\n\}\);\n\nexport function /g, '\n  });\n}\n\nexport function ');
    srcText = srcText.replace(/\n\}\);\n\nfunction /g, '\n  });\n}\n\nfunction ');
    srcText = srcText.replace(/\n\}\);\n\nconst /g, '\n  });\n}\n\nconst ');
    srcText = srcText.replace(/\n\}\);\n\nexport default function /g, '\n  });\n}\n\nexport default function ');
  }

  const fnRegex = /export (?:default )?function (\w+)\([^)]*\)\s*\{/g;
  let match;
  const names = [];
  while ((match = fnRegex.exec(srcText)) !== null) {
    names.push(match[1]);
  }

  for (const name of names) {
    const bodyStart = new RegExp(`export (?:default )?function ${name}\\([^)]*\\)\\s*\\{`);
    if (!bodyStart.test(srcText)) continue;
    const fnBody = srcText.split(bodyStart)[1];
    if (!fnBody) continue;
    const slice = fnBody.slice(0, 200);
    if (slice.includes('const colors = useColors()')) continue;
    const needsStyles = usesColorsInStyles && /styles\./.test(srcText);
    const inject = needsStyles
      ? '  const colors = useColors();\n  const styles = useMemo(() => createStyles(colors), [colors]);\n'
      : '  const colors = useColors();\n';
    srcText = srcText.replace(bodyStart, (m) => `${m}\n${inject}`);
  }

  const innerFnRegex = /^function (\w+)\([^)]*\)\s*\{/gm;
  while ((match = innerFnRegex.exec(srcText)) !== null) {
    const name = match[1];
    if (name === 'createStyles') continue;
    const idx = match.index;
    const after = srcText.slice(idx, idx + 120);
    if (after.includes('const colors = useColors()')) continue;
    if (!/\bcolors\./.test(srcText.slice(idx, idx + 800))) continue;
    srcText =
      srcText.slice(0, idx + match[0].length) +
      '\n  const colors = useColors();\n' +
      srcText.slice(idx + match[0].length);
  }

  if (srcText.includes("import { useMemo } from 'react';\n\nimport { useMemo }")) {
    srcText = srcText.replace(/import \{ useMemo \} from 'react';\n\nimport \{ useMemo \} from 'react';\n\n/g, "import { useMemo } from 'react';\n\n");
  }

  if (!srcText.includes('useMemo') && usesColorsInStyles) {
    srcText = "import { useMemo } from 'react';\n" + srcText;
  }

  fs.writeFileSync(filePath, srcText);
  return true;
}

const files = walk(src);
let count = 0;
for (const f of files) {
  if (migrateFile(f)) {
    count += 1;
    console.log('migrated', path.relative(root, f));
  }
}
console.log('done', count);
