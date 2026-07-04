import { describe, expect, it } from 'vitest';
import {
  buildUserMessage,
  checkAnswer,
  NO_ANSWER_SENTENCE,
  parseCitations,
  SYSTEM_PROMPT,
} from '../src/lib/answer';

const CHUNKS = [
  { sectionId: '18', idx: -1, body: 'General bonds...', score: 0.9 },
  { sectionId: '18A', idx: 0, body: 'No other security...', score: 0.8 },
];

describe('SYSTEM_PROMPT', () => {
  it('pins the citation format and the exact refusal sentence', () => {
    expect(SYSTEM_PROMPT).toContain('[s 18]');
    expect(SYSTEM_PROMPT).toContain(NO_ANSWER_SENTENCE);
    expect(SYSTEM_PROMPT).toContain('not legal advice');
  });
});

describe('buildUserMessage', () => {
  it('labels every chunk with its section id', () => {
    const message = buildUserMessage({ question: 'How much bond?', chunks: CHUNKS });
    expect(message).toContain('Question: How much bond?');
    expect(message).toContain('[s 18]\nGeneral bonds...');
    expect(message).toContain('[s 18A]\nNo other security...');
  });
});

describe('parseCitations', () => {
  it('extracts distinct citations in order, including letter suffixes', () => {
    expect(
      parseCitations('Bond is capped [s 18] and no extras [s 18A]; see [s 18] again.'),
    ).toEqual(['18', '18A']);
  });

  it('tolerates extra whitespace and ignores malformed forms', () => {
    expect(parseCitations('See [s  22A] but not [section 5] or [s]')).toEqual(['22A']);
  });

  it('accepts subsection detail and validates the base section', () => {
    expect(
      parseCitations('Rates are on the landlord [s 39(2)(a)] and power on you [s 39(3)].'),
    ).toEqual(['39']);
  });
});

describe('checkAnswer', () => {
  it('accepts a grounded answer citing provided sections', () => {
    const check = checkAnswer('The bond is capped at 4 weeks [s 18].', ['18', '18A']);
    expect(check).toMatchObject({ ok: true, hallucinated: [], declined: false });
  });

  it('flags citations to sections that were never provided', () => {
    const check = checkAnswer('You must insure the house [s 99].', ['18']);
    expect(check.ok).toBe(false);
    expect(check.hallucinated).toEqual(['99']);
  });

  it('rejects substantive answers with no citations at all', () => {
    expect(checkAnswer('The bond is capped at 4 weeks.', ['18']).ok).toBe(false);
  });

  it('accepts the exact no-answer sentence and nothing else', () => {
    expect(checkAnswer(NO_ANSWER_SENTENCE, ['18']).ok).toBe(true);
    expect(checkAnswer(NO_ANSWER_SENTENCE, ['18']).declined).toBe(true);
    expect(checkAnswer(`${NO_ANSWER_SENTENCE} But maybe [s 18].`, ['18']).declined).toBe(false);
  });
});
