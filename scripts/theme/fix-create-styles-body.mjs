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
    /function create\w*Styles\(colors: AppColors\) \{\n\s*const colors = useColors\(\);\n\s*const styles = useMemo\(\(\) => create\w*Styles\(colors\), \[colors\]\);\n\s*\n/g,
    'function createStyles(colors: AppColors) {\n',
  );
  text = text.replace(
    /function create\w*Styles\(colors: AppColors\) \{\n\s*const colors = useColors\(\);\n\s*\n/g,
    (m) => m.replace(/\s*const colors = useColors\(\);\n\s*\n/, '\n'),
  );

  const fnStart = /(?:export (?:default )?)?function (\w+)\([^)]*\)\s*\{/g;
  const matches = [...text.matchAll(fnStart)];
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const m = matches[i];
    const name = m[1];
    if (/^create\w*Styles$/.test(name)) continue;
    const start = m.index + m[0].length;
    const nextFn = matches[i + 1]?.index ?? text.length;
    const body = text.slice(start, nextFn);
    if (!/\bstyles\./.test(body)) continue;
    if (body.includes('const styles = useMemo')) continue;
    const inject =
      '  const colors = useColors();\n  const styles = useMemo(() => createStyles(colors), [colors]);\n';
    if (!body.includes('const colors = useColors()')) {
      text = text.slice(0, start) + '\n' + inject + text.slice(start);
    } else {
      text =
        text.slice(0, start) +
        '\n  const styles = useMemo(() => createStyles(colors), [colors]);\n' +
        text.slice(start);
    }
  }

  if (text !== original) {
    fs.writeFileSync(filePath, text);
    console.log('fixed', path.relative(root, filePath));
  }
}
