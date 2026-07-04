/**
 * Answer generation contract: the model must ground every claim in
 * the retrieved sections and cite them inline as [s 42]. Citation
 * parsing and validation are pure so the eval can score citation
 * accuracy without any model in the loop.
 */

import type { RetrievedChunk } from './retrieval';

export const NO_ANSWER_SENTENCE = 'The Act does not directly address this.';

export interface AnswerContext {
  question: string;
  chunks: RetrievedChunk[];
}

/** System prompt enforcing grounding, citations and the no-answer path. */
export const SYSTEM_PROMPT = `You are TenancyMate, answering questions about New Zealand's Residential Tenancies Act 1986.

Rules, in order of priority:
1. Use only the provided sections. Never rely on outside knowledge of the law.
2. Cite the section for every claim, inline, in exactly this form: [s 18] or [s 13A]. Cite exactly one section per bracket pair. Cite only the bracketed section labels of the provided sections; never cite a section that is merely mentioned inside their text.
3. If the provided sections do not answer the question, reply with exactly: "${NO_ANSWER_SENTENCE}" and nothing else.
4. Be concise: two to five sentences, plain language, no headings or lists.
5. You provide general information, not legal advice, and must not present it as advice.`;

/** The user message: question plus the retrieved statutory material. */
export function buildUserMessage(context: AnswerContext): string {
  const material = context.chunks
    .map((chunk) => `[s ${chunk.sectionId}]\n${chunk.body}`)
    .join('\n\n---\n\n');
  return `Question: ${context.question}\n\nProvided sections of the Residential Tenancies Act 1986:\n\n${material}`;
}

// Accepts subsection detail like [s 39(2)(a)] or trailing prose the
// model sneaks in; the leading base section is what gets validated
// and linked.
const CITATION_PATTERN = /\[s\s+(\d+[A-Z]{0,3})[^\]]*\]/g;

/** Distinct section ids cited in an answer, in order of appearance. */
export function parseCitations(answer: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of answer.matchAll(CITATION_PATTERN)) {
    const id = match[1];
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export interface AnswerCheck {
  /** Sections cited in the answer. */
  citations: string[];
  /** Citations pointing at sections that were not retrieved. */
  hallucinated: string[];
  /** True when the model used the exact no-answer sentence. */
  declined: boolean;
  /** A substantive answer must carry at least one valid citation. */
  ok: boolean;
}

/** Validate an answer against the sections that were actually provided. */
export function checkAnswer(answer: string, providedSections: readonly string[]): AnswerCheck {
  const declined = answer.trim() === NO_ANSWER_SENTENCE;
  const citations = parseCitations(answer);
  const provided = new Set(providedSections);
  const hallucinated = citations.filter((section) => !provided.has(section));

  const ok = declined ? citations.length === 0 : citations.length > 0 && hallucinated.length === 0;

  return { citations, hallucinated, declined, ok };
}
