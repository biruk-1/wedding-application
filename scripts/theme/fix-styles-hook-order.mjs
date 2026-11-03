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
  const original = text;

  text = text.replace(
    /(\{\n)\s*const styles = useMemo\(\(\) => create(\w+)Styles\(colors\), \[colors\]\);\n\s*\n\s*const colors = useColors\(\);\n/g,
    '$1  const colors = useColors();\n  const styles = useMemo(() => create$2Styles(colors), [colors]);\n',
  );

  const factoryMatch = text.match(/function (create\w*Styles)\(colors: AppColors\)/);
  if (factoryMatch) {
    const factory = factoryMatch[1];
    text = text.replace(
      new RegExp(`const styles = useMemo\\(\\(\\) => createStyles\\(colors\\), \\[colors\\]\\);`, 'g'),
      `const styles = useMemo(() => ${factory}(colors), [colors]);`,
    );
  }

  if (text !== original) {
    fs.writeFileSync(filePath, text);
    console.log('order', path.relative(root, filePath));
  }
}
