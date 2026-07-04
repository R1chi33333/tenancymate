/**
 * Retrieval over the embedded corpus. Two strategies share one
 * interface so the eval can compare them: vector-only similarity,
 * and hybrid, which fuses vector and full-text rankings with
 * reciprocal rank fusion.
 */

export interface RetrievedChunk {
  sectionId: string;
  idx: number;
  body: string;
  score: number;
}

/** Tagged-template SQL runner (the neon client, or a fake in tests). */
export type SqlRunner = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

export type Strategy = 'vector' | 'hybrid';

const CANDIDATES = 20;

export async function vectorSearch(
  sql: SqlRunner,
  queryVector: string,
  k: number,
): Promise<RetrievedChunk[]> {
  const rows = await sql`
    SELECT section_id, idx, body, 1 - (embedding <=> ${queryVector}::vector) AS score
    FROM chunks
    ORDER BY embedding <=> ${queryVector}::vector
    LIMIT ${k}`;
  return rows.map((row) => ({
    sectionId: String(row.section_id),
    idx: Number(row.idx),
    body: String(row.body),
    score: Number(row.score),
  }));
}

export async function textSearch(
  sql: SqlRunner,
  query: string,
  k: number,
): Promise<RetrievedChunk[]> {
  const rows = await sql`
    SELECT section_id, idx, body,
           ts_rank(tsv, websearch_to_tsquery('english', ${query})) AS score
    FROM chunks
    WHERE tsv @@ websearch_to_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${k}`;
  return rows.map((row) => ({
    sectionId: String(row.section_id),
    idx: Number(row.idx),
    body: String(row.body),
    score: Number(row.score),
  }));
}

const RRF_K = 60;

/**
 * Reciprocal rank fusion: chunks scoring well in either ranking rise.
 * The standard constant of 60 damps the head of each list.
 */
export function rrfFuse(
  lists: readonly (readonly RetrievedChunk[])[],
  k: number,
): RetrievedChunk[] {
  const scores = new Map<string, { chunk: RetrievedChunk; score: number }>();
  for (const list of lists) {
    for (const [rank, chunk] of list.entries()) {
      const key = `${chunk.sectionId}#${String(chunk.idx)}`;
      const entry = scores.get(key) ?? { chunk, score: 0 };
      entry.score += 1 / (RRF_K + rank + 1);
      scores.set(key, entry);
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((entry) => ({ ...entry.chunk, score: entry.score }));
}

export interface RetrieveDeps {
  sql: SqlRunner;
  /** Embed one query into pgvector text form. */
  embedQuery: (query: string) => Promise<string>;
}

export async function retrieve(
  deps: RetrieveDeps,
  query: string,
  options: { k?: number; strategy?: Strategy } = {},
): Promise<RetrievedChunk[]> {
  const k = options.k ?? 6;
  const strategy = options.strategy ?? 'hybrid';

  const queryVector = await deps.embedQuery(query);
  if (strategy === 'vector') {
    return vectorSearch(deps.sql, queryVector, k);
  }
  const [byVector, byText] = await Promise.all([
    vectorSearch(deps.sql, queryVector, CANDIDATES),
    textSearch(deps.sql, query, CANDIDATES),
  ]);
  return rrfFuse([byVector, byText], k);
}

/** Distinct section ids in rank order, for eval and citations. */
export function sectionsOf(chunks: readonly RetrievedChunk[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of chunks) {
    if (!seen.has(chunk.sectionId)) {
      seen.add(chunk.sectionId);
      out.push(chunk.sectionId);
    }
  }
  return out;
}
