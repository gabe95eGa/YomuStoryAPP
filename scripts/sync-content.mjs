// Copy the manifest's files byte-for-byte; never copy profiles or private data.
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'reader/public/content');
const staging = path.join(root, 'reader/public/content-staging');
for (const target of [destination, staging]) {
  const relative = path.relative(path.join(root, 'reader/public'), path.resolve(target));
  if (!['content', 'content-staging'].includes(relative)) throw new Error('Generated directory is outside reader/public.');
}
const schema = JSON.parse(await readFile(path.join(root, 'schema/yomustory-v1.schema.json'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

async function syncContent() {
  const manifestBytes = await readFile(path.join(root, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.schema_version !== '1.0' || !Array.isArray(manifest.stories)) {
    throw new Error('Invalid manifest. Run tools/build_manifest.py first.');
  }
  const ids = new Set();
  const copies = [];
  for (const item of manifest.stories) {
    if (!/^stories\/[a-z0-9_/-]+\.json$/.test(item.path) || item.path.split('/').includes('..')) {
      throw new Error(`Unsafe story path: ${item.path}`);
    }
    if (ids.has(item.id)) throw new Error(`Duplicate manifest story ID: ${item.id}`);
    ids.add(item.id);
    const source = await realpath(path.join(root, item.path));
    const relative = path.relative(root, source);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Story is outside repository.');
    const bytes = await readFile(source);
    const story = JSON.parse(bytes.toString('utf8'));
    if (!validate(story) || story.id !== item.id) {
      throw new Error(`Invalid story: ${item.path}. ${ajv.errorsText(validate.errors)}`);
    }
    for (const key of ['title', 'title_es', 'level', 'difficulty', 'estimated_minutes', 'topics']) {
      if (JSON.stringify(story.metadata[key]) !== JSON.stringify(item[key])) {
        throw new Error(`Stale manifest metadata: ${item.id}.${key}. Rebuild the manifest.`);
      }
    }
    copies.push({ relative: item.path, bytes });
  }
  // These fixed generated directories are confined to reader/public.
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await writeFile(path.join(staging, 'manifest.json'), manifestBytes);
  for (const copy of copies) {
    const output = path.join(staging, copy.relative);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, copy.bytes);
  }
  await rm(destination, { recursive: true, force: true });
  await rename(staging, destination);
  console.log(`Prepared ${copies.length} stories from manifest.json.`);
}

syncContent().catch((error) => { console.error(error.message); process.exitCode = 1; });
