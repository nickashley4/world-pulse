// Cache busting: GitHub Pages serves files with max-age=600, so browsers can keep old CSS/JS for up
// to 10 minutes after a deploy. Stamp asset URLs with a hash of docs/ code so changes load at once.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DOCS = path.resolve(import.meta.dirname, '..', 'docs');
const STAMP = /\?v=[\w-]+/g;
const read = (f) => fs.readFileSync(path.join(DOCS, f), 'utf8');

const hash = createHash('sha256');
for (const f of ['index.html', 'app.js', 'space.js', 'style.css']) hash.update(read(f).replace(STAMP, ''));
const v = hash.digest('hex').slice(0, 10);

function rewrite(file, re) {
  const src = read(file);
  const out = src.replace(re, (_, prefix) => `${prefix}?v=${v}`);
  if (out !== src) {
    fs.writeFileSync(path.join(DOCS, file), out);
    console.log(`stamped ${file}`);
  }
}
rewrite('index.html', /((?:href|src)="(?:style\.css|app\.js))(?:\?v=[\w-]+)?/g);
rewrite('app.js', /(from '\.\/space\.js)(?:\?v=[\w-]+)?/g);
console.log(`asset version ${v}`);
