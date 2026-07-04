/**
 * Corpus pipeline entrypoint: fetch the Act, split it into sections
 * and chunks, and write data/corpus.json. Embedding and database
 * loading live in later stages. Run with: npm run pipeline
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { chunkSection, parseAct } from './lib/corpus.ts';

const ACT_URL = 'https://www.legislation.govt.nz/act/public/1986/0120/latest/whole.html';

console.log('Fetching the Residential Tenancies Act 1986...');
const response = await fetch(ACT_URL, {
  headers: {
    'User-Agent': 'tenancymate-pipeline/1.0 (+https://github.com/R1chi33333/tenancymate)',
  },
});
if (!response.ok) {
  throw new Error(`Fetch failed: ${String(response.status)}`);
}
const html = await response.text();

const sections = parseAct(html);
const chunks = sections.flatMap(chunkSection);

const out = new URL('../data/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(
  new URL('corpus.json', out),
  JSON.stringify(
    {
      source: ACT_URL,
      licence: 'CC BY 4.0, Crown copyright, via legislation.govt.nz',
      generatedAt: new Date().toISOString(),
      sections,
      chunks,
    },
    null,
    1,
  ),
);
console.log(
  `Wrote data/corpus.json: ${String(sections.length)} sections, ${String(chunks.length)} chunks.`,
);
