/**
 * The full ask flow shared by the API route and the eval:
 * retrieve, generate, validate citations.
 */

import { neon } from '@neondatabase/serverless';
import { checkAnswer, type AnswerCheck } from './answer';
import { generateAnswer } from './generate';
import { getQueryEmbedder } from './query-embedding';
import { retrieve, sectionsOf, type RetrievedChunk, type SqlRunner } from './retrieval';

export interface AskResult {
  answer: string;
  chunks: RetrievedChunk[];
  providedSections: string[];
  check: AnswerCheck;
}

export interface AskDeps {
  sql: SqlRunner;
  embedQuery: (query: string) => Promise<string>;
  generate: (context: { question: string; chunks: RetrievedChunk[] }) => Promise<string>;
}

export function defaultDeps(): AskDeps {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return {
    sql: neon(url) as unknown as SqlRunner,
    embedQuery: getQueryEmbedder(),
    generate: generateAnswer,
  };
}

export async function ask(question: string, deps: AskDeps = defaultDeps()): Promise<AskResult> {
  const chunks = await retrieve({ sql: deps.sql, embedQuery: deps.embedQuery }, question, {
    k: 6,
    strategy: 'hybrid',
  });
  const providedSections = sectionsOf(chunks);
  const answer = await deps.generate({ question, chunks });
  const check = checkAnswer(answer, providedSections);
  return { answer, chunks, providedSections, check };
}
