/**
 * Demo affordability guard, sized against real free-tier budgets:
 * the production model allows about 100k tokens per day, roughly 50
 * answers, so the global cap stays under it and a per-IP cap keeps
 * one visitor from draining the day.
 */

import type { SqlRunner } from './retrieval';

export const DAILY_GLOBAL_CAP = Number(process.env.DAILY_REQUEST_CAP ?? 40);
export const DAILY_IP_CAP = 8;

export interface RateDecision {
  allowed: boolean;
  reason?: 'global' | 'ip';
  globalUsed: number;
  ipUsed: number;
}

let tableReady = false;

async function ensureTable(sql: SqlRunner): Promise<void> {
  if (tableReady) {
    return;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS usage_counters (
      day DATE NOT NULL,
      scope TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, scope)
    )`;
  tableReady = true;
}

/** Atomically increment both counters and decide. */
export async function checkRateLimit(sql: SqlRunner, ip: string): Promise<RateDecision> {
  await ensureTable(sql);
  const rows = (await sql`
    INSERT INTO usage_counters (day, scope, count)
    VALUES (CURRENT_DATE, 'global', 1), (CURRENT_DATE, ${`ip:${ip}`}, 1)
    ON CONFLICT (day, scope) DO UPDATE SET count = usage_counters.count + 1
    RETURNING scope, count`) as { scope: string; count: number }[];

  const globalUsed = rows.find((row) => row.scope === 'global')?.count ?? 0;
  const ipUsed = rows.find((row) => row.scope !== 'global')?.count ?? 0;

  if (globalUsed > DAILY_GLOBAL_CAP) {
    return { allowed: false, reason: 'global', globalUsed, ipUsed };
  }
  if (ipUsed > DAILY_IP_CAP) {
    return { allowed: false, reason: 'ip', globalUsed, ipUsed };
  }
  return { allowed: true, globalUsed, ipUsed };
}
