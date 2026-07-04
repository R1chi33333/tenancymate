import { describe, expect, it, vi } from 'vitest';
import {
  retrieve,
  rrfFuse,
  sectionsOf,
  textSearch,
  vectorSearch,
  type RetrievedChunk,
  type SqlRunner,
} from '../src/lib/retrieval';

function chunk(sectionId: string, idx = 0, score = 0.5): RetrievedChunk {
  return { sectionId, idx, body: `body of s ${sectionId}`, score };
}

/** Fake tagged-template runner that records the query and returns rows. */
function fakeSql(rows: Record<string, unknown>[]): { sql: SqlRunner; queries: string[] } {
  const queries: string[] = [];
  const sql: SqlRunner = (strings, ...values) => {
    queries.push(strings.join('?') + '|' + values.map(String).join(','));
    return Promise.resolve(rows);
  };
  return { sql, queries };
}

describe('vectorSearch and textSearch', () => {
  it('orders by embedding distance with the query vector bound', async () => {
    const { sql, queries } = fakeSql([{ section_id: '18', idx: 0, body: 'b', score: 0.9 }]);
    const result = await vectorSearch(sql, '[0.1,0.2]', 5);
    expect(result[0]).toMatchObject({ sectionId: '18', score: 0.9 });
    expect(queries[0]).toContain('embedding <=>');
    expect(queries[0]).toContain('[0.1,0.2]');
  });

  it('uses websearch full-text matching', async () => {
    const { sql, queries } = fakeSql([{ section_id: '51', idx: 1, body: 'b', score: 0.4 }]);
    const result = await textSearch(sql, 'notice periodic tenancy', 5);
    expect(result[0]).toMatchObject({ sectionId: '51', idx: 1 });
    expect(queries[0]).toContain('websearch_to_tsquery');
  });
});

describe('rrfFuse', () => {
  it('ranks chunks appearing in both lists above single-list chunks', () => {
    const byVector = [chunk('18'), chunk('21'), chunk('19')];
    const byText = [chunk('22'), chunk('18'), chunk('23')];

    const fused = rrfFuse([byVector, byText], 4);

    expect(fused[0]?.sectionId).toBe('18');
    expect(fused.map((c) => c.sectionId)).toHaveLength(4);
  });

  it('respects k and keeps chunk identity by section and index', () => {
    const a = [chunk('18', 0), chunk('18', 1)];
    const b = [chunk('18', 1)];
    const fused = rrfFuse([a, b], 1);
    expect(fused).toHaveLength(1);
    expect(fused[0]?.idx).toBe(1);
  });

  it('handles empty lists', () => {
    expect(rrfFuse([[], []], 5)).toEqual([]);
  });
});

describe('retrieve', () => {
  it('vector strategy embeds once and skips text search', async () => {
    const { sql, queries } = fakeSql([{ section_id: '18', idx: 0, body: 'b', score: 0.8 }]);
    const embedQuery = vi.fn().mockResolvedValue('[1,2,3]');

    const result = await retrieve({ sql, embedQuery }, 'bond limit', {
      strategy: 'vector',
      k: 3,
    });

    expect(embedQuery).toHaveBeenCalledOnce();
    expect(queries).toHaveLength(1);
    expect(result[0]?.sectionId).toBe('18');
  });

  it('hybrid strategy fuses both searches', async () => {
    let call = 0;
    const sql: SqlRunner = () => {
      call++;
      return Promise.resolve(
        call === 1
          ? [{ section_id: '18', idx: 0, body: 'b', score: 0.9 }]
          : [{ section_id: '51', idx: 0, body: 'b', score: 0.5 }],
      );
    };
    const embedQuery = vi.fn().mockResolvedValue('[1]');

    const result = await retrieve({ sql, embedQuery }, 'bond', { k: 2 });

    expect(result.map((c) => c.sectionId).sort()).toEqual(['18', '51']);
  });
});

describe('sectionsOf', () => {
  it('deduplicates sections preserving rank order', () => {
    expect(sectionsOf([chunk('18', 0), chunk('18', 1), chunk('21')])).toEqual(['18', '21']);
  });
});

describe('toPgVector', () => {
  it('formats vectors for pgvector', async () => {
    const { toPgVector } = await import('../src/lib/pgvector');
    expect(toPgVector([0.1, -0.25])).toBe('[0.100000,-0.250000]');
  });
});
