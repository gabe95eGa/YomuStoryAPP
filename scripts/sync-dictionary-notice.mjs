import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Attribution stays available even when the optional dictionary has not been prepared.
const publicRoot = new URL('../reader/public/', import.meta.url);
await mkdir(publicRoot, { recursive: true });
await writeFile(new URL('dictionary-notice.md', publicRoot), await readFile(new URL('../dictionary/NOTICE.md', import.meta.url)));
