'use client';

/**
 * Query embedding in the browser. The same MiniLM the pipeline used
 * for the corpus runs here via transformers.js WASM, so the server
 * needs no ML runtime at all. The ~25 MB model downloads once on the
 * first question and is cached by the browser afterwards.
 */

export type BrowserEmbedder = (text: string) => Promise<number[]>;

let embedderPromise: Promise<BrowserEmbedder> | undefined;

async function create(onProgress?: (message: string) => void): Promise<BrowserEmbedder> {
  const { pipeline } = await import('@huggingface/transformers');
  onProgress?.('Loading the embedding model (about 25 MB, first time only)...');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'q8',
    device: 'wasm',
  });
  return async (text: string) => {
    const output = await extractor([text], { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  };
}

export function getBrowserEmbedder(
  onProgress?: (message: string) => void,
): Promise<BrowserEmbedder> {
  embedderPromise ??= create(onProgress);
  return embedderPromise;
}
