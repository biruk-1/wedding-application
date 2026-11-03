import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'src');

const keepThemed = new Set([
  'src/features/settings/screens/SettingsScreen.tsx',
  'src/features/settings/components/WeddingStylePicker.tsx',
  'src/features/budget/components/CategoryBreakdownList.tsx',
  'src/features/weddings/components/DashboardHero.tsx',
  'src/features/checklist/components/CategoryCard.tsx',
  'src/components/ui/Card.tsx',
  'src/components/ui/Button.tsx',
  'src/components/ui/AppText.tsx',
]);

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
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  if (keepThemed.has(rel)) continue;

  let text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes('function createStyles(colors: AppColors)')) continue;

  text = text.replace(
    /function create\w*Styles\(colors: AppColors\) \{\s*return StyleSheet\.create\(\{([\s\S]*?)\}\);\s*\}/,
    'const styles = StyleSheet.create({$1});',
  );

  text = text.replace(/^\s*const colors = useColors\(\);\n/gm, '');
  text = text.replace(/^\s*const styles = useMemo\(\(\) => create\w*Styles\(colors\), \[colors\]\);\n/gm, '');
  text = text.replace(/import \{ useColors \} from '@\/theme\/WeddingThemeContext';\n/g, '');
  text = text.replace(/import type \{ AppColors \} from '@\/theme\/types';\n/g, '');
  text = text.replace(/import \{ useMemo \} from 'react';\n/g, '');

  if (/\bcolors\./.test(text) && !text.includes("@/theme/colors")) {
    text = text.replace(
      /^(import .+\n)+/,
      (block) => `${block}import { colors } from '@/theme/colors';\n`,
    );
  }

  fs.writeFileSync(filePath, text);
  console.log('reverted', rel);
}
