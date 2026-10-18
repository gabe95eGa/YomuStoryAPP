// Copy the manifest's files byte-for-byte; never copy profiles or private data.
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
  const stories = new Map();
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
    stories.set(story.id, story);
  }
  const audio = JSON.parse(await readFile(path.join(root, 'audio/catalog.json'), 'utf8'));
  if (audio.version !== 1 || !audio.stories || Array.isArray(audio.stories)) throw new Error('Invalid audio catalog.');
  for (const [id, entry] of Object.entries(audio.stories)) {
    const story = stories.get(id);
    const paragraphs = story?.content.paragraphs.map(({ id, sentences }) => ({ id, sentences: sentences.map(({ id, text }) => ({ id, text })) }));
    const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
    if (!/^[a-z0-9_]+$/.test(id) || entry.story_id !== id || entry.provider !== 'azure-speech-f0'
      || entry.review !== 'playback-checked' || !/^ja-JP-(Nanami|Keita)Neural$/.test(entry.voice)
      || !paragraphs || JSON.stringify(entry.paragraphs) !== JSON.stringify(paragraphs)
      || entry.source_sha256 !== hash(JSON.stringify(paragraphs))
      || !Array.isArray(entry.files) || entry.files.length !== paragraphs.length) throw new Error(`Invalid or stale narration: ${id}`);
    for (const [i, file] of entry.files.entries()) {
      if (file.path !== `audio/${id}/${String(i + 1).padStart(2, '0')}.mp3`) throw new Error('Unsafe audio path.');
      const source = await realpath(path.join(root, file.path));
      const relative = path.relative(path.join(root, 'audio'), source);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Audio is outside repository.');
      const bytes = await readFile(source);
      const mp3 = bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224);
      if (!mp3 || bytes.length < 256 || hash(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error(`Corrupt recording: ${file.path}`);
      copies.push({ relative: file.path, bytes });
    }
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
  // Windows can briefly retain a deleted directory handle after rm resolves.
  // Retry only transient filesystem locks; all other failures remain immediate.
  for (let attempt = 0; ; attempt++) {
    try { await rename(staging, destination); break; }
    catch (error) {
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 6) throw error;
      await delay(100 * 2 ** attempt);
    }
  }
  console.log(`Prepared ${stories.size} stories and ${Object.keys(audio.stories).length} narrations.`);
}

syncContent().catch((error) => { console.error(error.message); process.exitCode = 1; });
