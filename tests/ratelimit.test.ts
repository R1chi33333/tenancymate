import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, DAILY_GLOBAL_CAP, DAILY_IP_CAP } from '../src/lib/ratelimit';
import type { SqlRunner } from '../src/lib/retrieval';

/** In-memory fake of the two upserted counters. */
function fakeCounters(): { sql: SqlRunner } {
  const counts = new Map<string, number>();
  const sql: SqlRunner = (strings, ...values) => {
    const text = strings.join('?');
    if (text.includes('CREATE TABLE')) {
      return Promise.resolve([]);
    }
    const ipScope = String(values[0]);
    const rows = ['global', ipScope].map((scope) => {
      const next = (counts.get(scope) ?? 0) + 1;
      counts.set(scope, next);
      return { scope, count: next };
    });
    return Promise.resolve(rows);
  };
  return { sql };
}

describe('checkRateLimit', () => {
  let counters: { sql: SqlRunner };
  beforeEach(() => {
    counters = fakeCounters();
  });

  it('allows requests under both caps', async () => {
    const decision = await checkRateLimit(counters.sql, '1.2.3.4');
    expect(decision).toMatchObject({ allowed: true, globalUsed: 1, ipUsed: 1 });
  });

  it('blocks one IP at its daily cap without touching others', async () => {
    for (let i = 0; i < DAILY_IP_CAP; i++) {
      await checkRateLimit(counters.sql, '1.1.1.1');
    }
    const blocked = await checkRateLimit(counters.sql, '1.1.1.1');
    expect(blocked).toMatchObject({ allowed: false, reason: 'ip' });

    const other = await checkRateLimit(counters.sql, '2.2.2.2');
    expect(other.allowed).toBe(other.globalUsed <= DAILY_GLOBAL_CAP);
  });

  it('blocks everyone once the global cap is reached', async () => {
    for (let i = 0; i < DAILY_GLOBAL_CAP; i++) {
      await checkRateLimit(counters.sql, `10.0.0.${String(i % 8)}`);
    }
    const blocked = await checkRateLimit(counters.sql, '9.9.9.9');
    expect(blocked).toMatchObject({ allowed: false, reason: 'global' });
  });
});
