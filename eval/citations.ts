/**
 * End-to-end citation evaluation: run the full ask flow for every
 * eval question and score the citations against the ground truth.
 * Uses the real model, so it consumes free-tier quota; a polite
 * delay keeps it inside rate limits. Run with: npm run eval:citations
 *
 * Metrics:
 * - grounded rate: answers whose citations all point at provided
 *   sections (no hallucinated citations) and that carry at least one
 *   citation when substantive
 * - expected coverage: mean share of expected sections that the
 *   answer actually cites
 * - refusal correctness: out-of-scope questions answered with the
 *   exact no-answer sentence
 */

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { checkAnswer } from '../src/lib/answer';
import { ask } from '../src/lib/ask';

/**
 * Answers are cached to answers.jsonl as they arrive, so re-scoring
 * after a parser or metric change costs zero model tokens (see
 * rescore.ts) and a rate-limited run can resume where it stopped.
 */

interface QaPair {
  id: string;
  question: string;
  expectedSections: string[];
  answerable: boolean;
}

const qa = JSON.parse(await readFile(new URL('qa.json', import.meta.url), 'utf8')) as {
  pairs: QaPair[];
};

const DELAY_MS = 20_000; // paced for the 8k tokens-per-minute free tier
const CACHE = new URL('answers.jsonl', import.meta.url);

interface CachedAnswer {
  id: string;
  answer: string;
  providedSections: string[];
}

const cached = new Map<string, CachedAnswer>();
try {
  const lines = (await readFile(CACHE, 'utf8')).trim().split('\n');
  for (const line of lines) {
    if (line) {
      const entry = JSON.parse(line) as CachedAnswer;
      cached.set(entry.id, entry);
    }
  }
  console.log(`resuming with ${String(cached.size)} cached answers`);
} catch {
  // no cache yet
}

let grounded = 0;
let coverageSum = 0;
let refusalsCorrect = 0;
const failures: { id: string; kind: string; detail: string }[] = [];

const answerable = qa.pairs.filter((pair) => pair.answerable);
const outOfScope = qa.pairs.filter((pair) => !pair.answerable);

for (const pair of qa.pairs) {
  let entry = cached.get(pair.id);
  if (!entry) {
    const result = await ask(pair.question);
    entry = {
      id: pair.id,
      answer: result.answer,
      providedSections: result.providedSections,
    };
    await appendFile(CACHE, JSON.stringify(entry) + '\n');
    await sleep(DELAY_MS);
  }
  const check = checkAnswer(entry.answer, entry.providedSections);
  const answerText = entry.answer;

  if (pair.answerable) {
    if (check.ok && !check.declined) {
      grounded++;
    } else {
      failures.push({
        id: pair.id,
        kind: check.declined ? 'declined-answerable' : 'ungrounded',
        detail: check.hallucinated.length
          ? `hallucinated s ${check.hallucinated.join(', s ')}`
          : answerText.slice(0, 80),
      });
    }
    const cited = new Set(check.citations);
    const hits = pair.expectedSections.filter((section) => cited.has(section));
    coverageSum += hits.length / pair.expectedSections.length;
  } else {
    if (check.declined) {
      refusalsCorrect++;
    } else {
      failures.push({
        id: pair.id,
        kind: 'answered-out-of-scope',
        detail: answerText.slice(0, 80),
      });
    }
  }

  console.log(`${pair.id}: ${check.declined ? 'declined' : `cited ${check.citations.join(',')}`}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  answerableQuestions: answerable.length,
  outOfScopeQuestions: outOfScope.length,
  groundedRate: Math.round((grounded / answerable.length) * 1000) / 1000,
  expectedCoverage: Math.round((coverageSum / answerable.length) * 1000) / 1000,
  refusalCorrectness:
    outOfScope.length === 0
      ? null
      : Math.round((refusalsCorrect / outOfScope.length) * 1000) / 1000,
  failures,
};

await writeFile(new URL('citation-results.json', import.meta.url), JSON.stringify(report, null, 2));

console.log('\n| metric | value |');
console.log('| --- | --- |');
console.log(`| grounded rate | ${String(report.groundedRate)} |`);
console.log(`| expected-section coverage | ${String(report.expectedCoverage)} |`);
console.log(`| refusal correctness | ${String(report.refusalCorrectness)} |`);
console.log('\nfailures:');
for (const failure of failures) {
  console.log(`  ${failure.id} [${failure.kind}] ${failure.detail}`);
}
