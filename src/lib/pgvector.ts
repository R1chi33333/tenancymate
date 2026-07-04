/** Format a vector for pgvector's text representation. */
export function toPgVector(vector: readonly number[]): string {
  return `[${vector.map((value) => value.toFixed(6)).join(',')}]`;
}
