import { neon } from '@neondatabase/serverless';
import type { SqlRunner } from '@/lib/retrieval';

/** Full section texts for the citation panel. Public corpus data. */
export async function GET(request: Request): Promise<Response> {
  const idsParam = new URL(request.url).searchParams.get('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^\d+[A-Z]{0,3}$/.test(id))
    .slice(0, 12);
  if (ids.length === 0) {
    return Response.json({ sections: [] });
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    return Response.json({ error: 'server not configured' }, { status: 503 });
  }
  const sql = neon(url) as unknown as SqlRunner;

  const rows = await sql`
    SELECT id, heading, part, body FROM sections WHERE id = ANY(${ids})`;
  const bySection = new Map(rows.map((row) => [String(row.id), row]));
  const sections = ids
    .filter((id) => bySection.has(id))
    .map((id) => {
      const row = bySection.get(id);
      return {
        id,
        heading: String(row?.heading ?? ''),
        part: row?.part == null ? null : String(row.part),
        body: String(row?.body ?? ''),
      };
    });

  return Response.json(
    { sections },
    { headers: { 'Cache-Control': 'public, max-age=86400, immutable' } },
  );
}
