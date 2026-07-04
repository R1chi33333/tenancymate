import { neon } from '@neondatabase/serverless';
import { streamAnswer } from '@/lib/generate';
import { getQueryEmbedder } from '@/lib/query-embedding';
import { checkRateLimit } from '@/lib/ratelimit';
import { retrieve, sectionsOf, type SqlRunner } from '@/lib/retrieval';

export const maxDuration = 60;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: Request): Promise<Response> {
  const { question } = (await request.json().catch(() => ({}))) as { question?: string };
  if (!question || question.trim().length < 5 || question.length > 400) {
    return Response.json(
      { error: 'Ask a question between 5 and 400 characters.' },
      { status: 400 },
    );
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

  const chunks = await retrieve({ sql, embedQuery: getQueryEmbedder() }, question.trim(), {
    k: 6,
    strategy: 'hybrid',
  });

  const result = streamAnswer({ question: question.trim(), chunks });
  const response = result.toTextStreamResponse();
  response.headers.set('x-provided-sections', sectionsOf(chunks).join(','));
  return response;
}
