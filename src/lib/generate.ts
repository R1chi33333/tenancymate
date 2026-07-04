/**
 * Answer generation over retrieved sections. The model is behind
 * the Vercel AI SDK, so swapping Groq's free tier for the Claude
 * API is a one-line provider change; the citation contract in
 * answer.ts stays identical either way.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText, streamText, type LanguageModel } from 'ai';
import { buildUserMessage, SYSTEM_PROMPT, type AnswerContext } from './answer';

/** Production model; override with GENERATION_MODEL for dev to stay
 * inside separate free-tier daily token buckets. */
export const GENERATION_MODEL = process.env.GENERATION_MODEL ?? 'llama-3.3-70b-versatile';

let cached: LanguageModel | undefined;

export function defaultModel(): LanguageModel {
  if (!cached) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY ?? '' });
    cached = groq(GENERATION_MODEL);
  }
  return cached;
}

export async function generateAnswer(
  context: AnswerContext,
  model: LanguageModel = defaultModel(),
): Promise<string> {
  const { text } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: buildUserMessage(context),
    temperature: 0.1,
    maxOutputTokens: 400,
  });
  return text.trim();
}

/** Streaming variant for the chat UI. */
export function streamAnswer(context: AnswerContext, model: LanguageModel = defaultModel()) {
  return streamText({
    model,
    system: SYSTEM_PROMPT,
    prompt: buildUserMessage(context),
    temperature: 0.1,
    maxOutputTokens: 400,
  });
}
