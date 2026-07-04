/**
 * Load the corpus into Neon: sections for the citation panel,
 * chunks with embeddings and a full-text index for retrieval.
 * Idempotent: tables are rebuilt from data/corpus.json each run.
 *
 * Run with: npm run pipeline:embed
 */

import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import type { Chunk, Section } from './lib/corpus.ts';
import { EMBEDDING_DIM, getEmbedder, toPgVector } from './lib/embedder.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set');
}
const sql = neon(url);

const corpus = JSON.parse(
  await readFile(new URL('../data/corpus.json', import.meta.url), 'utf8'),
) as { sections: Section[]; chunks: Chunk[]; generatedAt: string };

console.log(
  `Corpus: ${String(corpus.sections.length)} sections, ${String(corpus.chunks.length)} chunks.`,
);

await sql`CREATE EXTENSION IF NOT EXISTS vector`;
await sql`DROP TABLE IF EXISTS chunks`;
await sql`DROP TABLE IF EXISTS sections`;
await sql`
  CREATE TABLE sections (
    id TEXT PRIMARY KEY,
    heading TEXT NOT NULL,
    part TEXT,
    body TEXT NOT NULL
  )`;
await sql`
  CREATE TABLE chunks (
    id SERIAL PRIMARY KEY,
    section_id TEXT NOT NULL REFERENCES sections(id),
    idx INTEGER NOT NULL,
    body TEXT NOT NULL,
    embedding vector(${sql.unsafe(String(EMBEDDING_DIM))}) NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED
  )`;
await sql`CREATE INDEX chunks_tsv ON chunks USING GIN (tsv)`;

console.log('Inserting sections...');
for (const section of corpus.sections) {
  await sql`INSERT INTO sections (id, heading, part, body)
            VALUES (${section.id}, ${section.heading}, ${section.part}, ${section.text})`;
}

console.log('Embedding chunks (first run downloads the model)...');
const embed = await getEmbedder();
const BATCH = 16;
for (let i = 0; i < corpus.chunks.length; i += BATCH) {
  const batch = corpus.chunks.slice(i, i + BATCH);
  const vectors = await embed(batch.map((chunk) => chunk.text));
  for (const [j, chunk] of batch.entries()) {
    const vector = vectors[j];
    if (!vector) {
      throw new Error('embedding batch size mismatch');
    }
    await sql`INSERT INTO chunks (section_id, idx, body, embedding)
              VALUES (${chunk.sectionId}, ${chunk.index}, ${chunk.text}, ${toPgVector(vector)}::vector)`;
  }
  console.log(
    `  ${String(Math.min(i + BATCH, corpus.chunks.length))}/${String(corpus.chunks.length)}`,
  );
}

const count = (await sql`SELECT COUNT(*) AS n FROM chunks`) as { n: string }[];
console.log(`Done: ${count[0]?.n ?? '?'} chunks embedded and stored.`);
