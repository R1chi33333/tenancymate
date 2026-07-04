import { neon } from '@neondatabase/serverless';
import { streamAnswer } from '@/lib/generate';
import { toPgVector } from '@/lib/pgvector';
import { checkRateLimit } from '@/lib/ratelimit';
import { retrieve, sectionsOf, type SqlRunner } from '@/lib/retrieval';

const EMBEDDING_DIM = 384;

/** The browser computes the query embedding; verify and renormalise. */
function parseVector(input: unknown): string | null {
  if (!Array.isArray(input) || input.length !== EMBEDDING_DIM) {
    return null;
  }
  const values = input.map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return null;
  }
  return toPgVector(values.map((value) => value / norm));
}

export const maxDuration = 60;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    question?: string;
    vector?: unknown;
  };
  const question = body.question;
  if (!question || question.trim().length < 5 || question.length > 400) {
    return Response.json(
      { error: 'Ask a question between 5 and 400 characters.' },
      { status: 400 },
    );
  }
  const queryVector = parseVector(body.vector);
  if (!queryVector) {
    return Response.json({ error: 'missing or invalid query embedding' }, { status: 400 });
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    return Response.json({ error: 'server not configured' }, { status: 503 });
  }
  const sql = neon(url) as unknown as SqlRunner;

  const decision = await checkRateLimit(sql, clientIp(request));
  if (!decision.allowed) {
    const message =
      decision.reason === 'global'
        ? 'The free demo has reached its daily answer budget. Come back tomorrow.'
        : 'You have reached the daily limit for this demo.';
    return Response.json({ error: message }, { status: 429 });
  }

  const chunks = await retrieve(
    { sql, embedQuery: () => Promise.resolve(queryVector) },
    question.trim(),
    { k: 6, strategy: 'hybrid' },
  );

  const result = streamAnswer({ question: question.trim(), chunks });
  const response = result.toTextStreamResponse();
  response.headers.set('x-provided-sections', sectionsOf(chunks).join(','));
  return response;
}
