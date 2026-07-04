/**
 * Local sentence embeddings with MiniLM via transformers.js.
 * No API keys: the model downloads from the Hugging Face hub on
 * first use and is cached on disk afterwards. The same model runs
 * at query time so corpus and query share one vector space.
 */

import { pipeline } from '@huggingface/transformers';

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

let embedderPromise: Promise<EmbedFn> | undefined;

async function create(): Promise<EmbedFn> {
  const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' });
  return async (texts: string[]) => {
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const [rows, dim] = output.dims;
    const flat = output.data as Float32Array;
    const vectors: number[][] = [];
    for (let row = 0; row < (rows ?? 0); row++) {
      vectors.push(Array.from(flat.slice(row * (dim ?? 0), (row + 1) * (dim ?? 0))));
    }
    return vectors;
  };
}

/** Shared lazy singleton; the model load is the expensive part. */
export function getEmbedder(): Promise<EmbedFn> {
  embedderPromise ??= create();
  return embedderPromise;
}

/** Format a vector for pgvector's text representation. */
export function toPgVector(vector: readonly number[]): string {
  return `[${vector.map((value) => value.toFixed(6)).join(',')}]`;
}
