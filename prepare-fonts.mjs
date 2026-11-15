import { mkdir, writeFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
await mkdir(new URL('assets/fonts/', root), { recursive: true });
const response = await fetch('https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500&family=Geist:wght@400;500;600&family=Cairo:wght@400;600&display=swap', { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!response.ok) throw new Error(`Fonts: ${response.status}`);
let css = await response.text();
let index = 0;
for (const remote of [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(match => match[1]))]) {
  const response = await fetch(remote);
  if (!response.ok) throw new Error(`Font download: ${response.status}`);
  const name = `type-${++index}.${new URL(remote).pathname.split('.').at(-1)}`;
  await writeFile(new URL(`assets/fonts/${name}`, root), Buffer.from(await response.arrayBuffer()));
  css = css.replaceAll(remote, `assets/fonts/${name}`);
}
await writeFile(new URL('fonts.css', root), css);
for (const family of ['newsreader', 'geist', 'cairo']) {
  const response = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`);
  if (!response.ok) throw new Error(`License: ${response.status}`);
  await writeFile(new URL(`assets/fonts/${family}-LICENSE.txt`, root), await response.text());
}
console.log(`Downloaded ${index} local fonts and their licenses.`);
