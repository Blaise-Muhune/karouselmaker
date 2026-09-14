import { Pool, types, type QueryResultRow } from "pg";

// Match Supabase/PostgREST: return timestamps as ISO strings, not Date objects.
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => v);
types.setTypeParser(types.builtins.TIMESTAMP, (v) => v);

type GlobalPg = typeof globalThis & { __karouselmakerPgPool?: Pool };
const globalPg = globalThis as GlobalPg;

function poolMaxConnections(): number {
  const configured = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  if (Number.isFinite(configured) && configured >= 1) return Math.min(configured, 10);
  // Vercel can run many isolated function instances. One client per instance is
  // deliberate: it protects the small Azure Postgres server from connection storms.
  return process.env.VERCEL ? 1 : 5;
}

/**
 * Azure PostgreSQL pool. Auth stays on Supabase; this is the app data plane only.
 * Requires DATABASE_URL (postgresql://...sslmode=require).
 */
export function getPool(): Pool {
  if (globalPg.__karouselmakerPgPool) return globalPg.__karouselmakerPgPool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL. Set it to your Azure PostgreSQL connection string (see docs/azure-postgres.md)."
    );
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: poolMaxConnections(),
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    // Do not keep a Vercel function alive just to preserve an idle DB connection.
    allowExitOnIdle: true,
  });
  globalPg.__karouselmakerPgPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return getPool().query<T>(text, params);
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const res = await query<T>(text, params);
  return res.rows[0] ?? null;
}

export async function queryMany<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await query<T>(text, params);
  return res.rows;
}
