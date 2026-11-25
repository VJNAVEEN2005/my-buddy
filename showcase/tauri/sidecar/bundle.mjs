import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist/node_modules', { recursive: true });

const webExt = ['@mozilla/readability', 'turndown', 'turndown-plugin-gfm', 'unpdf', 'mammoth'];
const externals = [
  '@huggingface/transformers',
  'ogg-opus-decoder',
  ...webExt,
].map((e) => `--external:${e}`).join(' ');

const banner = `--banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"`;

console.log('Bundling sidekick.mjs...');
execSync(`npx esbuild sidekick.mjs --bundle --platform=node --format=esm --target=node22 --outfile=dist/sidekick.mjs ${externals} ${banner} --log-level=warning`, { stdio: 'inherit' });

console.log('Bundling agentrun.mjs...');
execSync(`npx esbuild agentrun.mjs --bundle --platform=node --format=esm --target=node22 --outfile=dist/agentrun.mjs ${externals} ${banner} --log-level=warning`, { stdio: 'inherit' });

const done = new Set();
function copy(name, from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const src = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(src, 'package.json'))) {
      if (dir !== process.cwd() || done.has(name)) return;
      done.add(name);
      fs.cpSync(src, path.join('dist/node_modules', name), { recursive: true, dereference: true });
      const pkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));
      for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) copy(dep, src);
      return;
    }
    if (dir === process.cwd()) return console.error(`bundle: ${name} isn't installed; web_fetch will read pages as plain text`);
    if (path.dirname(dir) === dir) break;
  }
}
for (const name of ['linkedom', ...webExt]) copy(name, process.cwd());

fs.mkdirSync('dist/beats', { recursive: true });
if (fs.existsSync('beats/index.json')) {
  fs.copyFileSync('beats/index.json', 'dist/beats/index.json');
}
for (const f of fs.readdirSync('beats')) {
  if (f.endsWith('.pcm')) {
    fs.copyFileSync(path.join('beats', f), path.join('dist/beats', f));
  }
}

fs.writeFileSync('dist/package.json', '{"type":"module"}\n');
console.log('Sidecar bundle complete!');
