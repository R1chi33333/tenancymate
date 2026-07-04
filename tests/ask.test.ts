import { describe, expect, it, vi } from 'vitest';
import { ask, type AskDeps } from '../src/lib/ask';
import { NO_ANSWER_SENTENCE } from '../src/lib/answer';
import type { SqlRunner } from '../src/lib/retrieval';

function deps(answer: string): AskDeps {
  const sql: SqlRunner = () =>
    Promise.resolve([{ section_id: '18', idx: -1, body: 'General bonds...', score: 0.9 }]);
  return {
    sql,
    embedQuery: vi.fn().mockResolvedValue('[0.1]'),
    generate: vi.fn().mockResolvedValue(answer),
  };
}

describe('ask', () => {
  it('retrieves, generates and validates a grounded answer', async () => {
    const result = await ask('How much bond?', deps('Capped at 4 weeks [s 18].'));
    expect(result.providedSections).toEqual(['18']);
    expect(result.check).toMatchObject({ ok: true, citations: ['18'] });
  });

  it('flags hallucinated citations from the generator', async () => {
    const result = await ask('How much bond?', deps('See [s 99].'));
    expect(result.check.ok).toBe(false);
    expect(result.check.hallucinated).toEqual(['99']);
  });

  it('passes through a clean refusal', async () => {
    const result = await ask('Tax question', deps(NO_ANSWER_SENTENCE));
    expect(result.check.declined).toBe(true);
    expect(result.check.ok).toBe(true);
  });
});
