/**
 * Query embedding for runtime: the same MiniLM as the corpus, loaded
 * lazily and cached across warm invocations. The first request on a
 * cold serverless instance pays the model download.
 */

import { getEmbedder } from '../../pipeline/lib/embedder';
import { toPgVector } from './pgvector';

export function getQueryEmbedder(): (query: string) => Promise<string> {
  return async (query: string) => {
    const embed = await getEmbedder();
    const [vector] = await embed([query]);
    if (!vector) {
      throw new Error('query embedding failed');
    }
    return toPgVector(vector);
  };
}
