/**
 * Retrieval evaluation: recall at k for the vector-only and hybrid
 * strategies over eval/qa.json. Run with: npm run eval
 *
 * Recall at k for one question is the share of its expected sections
 * that appear among the distinct sections of the top-k chunks; the
 * reported number is the mean over all answerable questions.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { getEmbedder } from '../pipeline/lib/embedder.ts';
import { toPgVector } from '../src/lib/pgvector.ts';
import { retrieve, sectionsOf, type SqlRunner, type Strategy } from '../src/lib/retrieval.ts';

interface QaPair {
  id: string;
  question: string;
  expectedSections: string[];
  answerable: boolean;
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set');
}
const sql = neon(url) as unknown as SqlRunner;

const qa = JSON.parse(await readFile(new URL('qa.json', import.meta.url), 'utf8')) as {
  pairs: QaPair[];
};
const pairs = qa.pairs.filter((pair) => pair.answerable);

// Guard the eval set itself: every expected section must exist.
const known = new Set(
  ((await sql`SELECT id FROM sections`) as { id: string }[]).map((row) => row.id),
);
for (const pair of pairs) {
  for (const section of pair.expectedSections) {
    if (!known.has(section)) {
      throw new Error(`eval pair ${pair.id} expects unknown section ${section}`);
    }
  }
}

const embed = await getEmbedder();
const embedQuery = async (query: string): Promise<string> => {
  const [vector] = await embed([query]);
  if (!vector) {
    throw new Error('query embedding failed');
  }
  return toPgVector(vector);
};

const K_VALUES = [3, 6];
const strategies: Strategy[] = ['vector', 'hybrid'];

interface StrategyResult {
  strategy: Strategy;
  recallAtK: Record<string, number>;
  misses: { id: string; missing: string[]; got: string[] }[];
}

const results: StrategyResult[] = [];

for (const strategy of strategies) {
  const recallSums = new Map<number, number>(K_VALUES.map((k) => [k, 0]));
  const misses: StrategyResult['misses'] = [];

  for (const pair of pairs) {
    const chunks = await retrieve({ sql, embedQuery }, pair.question, {
      strategy,
      k: Math.max(...K_VALUES),
    });

    for (const k of K_VALUES) {
      const sections = new Set(sectionsOf(chunks.slice(0, k)));
      const hits = pair.expectedSections.filter((section) => sections.has(section));
      recallSums.set(k, (recallSums.get(k) ?? 0) + hits.length / pair.expectedSections.length);
    }

    const allSections = new Set(sectionsOf(chunks));
    const missing = pair.expectedSections.filter((section) => !allSections.has(section));
    if (missing.length > 0) {
      misses.push({ id: pair.id, missing, got: sectionsOf(chunks) });
    }
  }

  results.push({
    strategy,
    recallAtK: Object.fromEntries(
      K_VALUES.map((k) => [
        `recall@${String(k)}`,
        Math.round(((recallSums.get(k) ?? 0) / pairs.length) * 1000) / 1000,
      ]),
    ),
    misses,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  questions: pairs.length,
  results: results.map(({ strategy, recallAtK }) => ({ strategy, ...recallAtK })),
  misses: Object.fromEntries(results.map((r) => [r.strategy, r.misses])),
};
await writeFile(new URL('results.json', import.meta.url), JSON.stringify(report, null, 2));

console.log(`\n${String(pairs.length)} answerable questions\n`);
console.log('| strategy | recall@3 | recall@6 |');
console.log('| --- | --- | --- |');
for (const result of results) {
  console.log(
    `| ${result.strategy} | ${String(result.recallAtK['recall@3'])} | ${String(result.recallAtK['recall@6'])} |`,
  );
}
for (const result of results) {
  console.log(`\n${result.strategy} misses (not in top 6):`);
  for (const miss of result.misses) {
    console.log(`  ${miss.id}: missing s ${miss.missing.join(', s ')} | got ${miss.got.join(',')}`);
  }
}
