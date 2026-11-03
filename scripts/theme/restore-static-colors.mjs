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
  if (text.includes('function createStyles(colors: AppColors)')) continue;
  if (!text.includes('useColors()')) continue;

  text = text.replace(/^\s*const colors = useColors\(\);\n/gm, '');
  text = text.replace(/import \{ useColors \} from '@\/theme\/WeddingThemeContext';\n/g, '');

  if (/\bcolors\./.test(text) && !text.includes("@/theme/colors")) {
    text = text.replace(
      /^(import .+\n)+/,
      (block) => `${block}import { colors } from '@/theme/colors';\n`,
    );
  }

  fs.writeFileSync(filePath, text);
  console.log('static', path.relative(root, filePath));
}
