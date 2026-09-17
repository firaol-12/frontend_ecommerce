import { Pool } from "pg";

// Serverless-safe Postgres pool.
//
// In the old Express app the pool was created once per server process. Under
// Vercel's serverless model every cold lambda start would otherwise create a
// NEW pool, quickly exhausting Postgres connections ("too many connections").
// Caching the pool on globalThis gives us:
//   - one pool per warm serverless instance (shared across invocations)
//   - one pool across Next.js dev hot reloads (no pool leak per code edit)
//   - a small `max` because the real connection-limit safety net is the
//     provider's pooled endpoint (Neon/Supabase "-pooler" URL / Vercel
//     Postgres). Point DATABASE_URL at a pooled connection string in prod.
const globalForPg = globalThis as unknown as { __ecommercePgPool?: Pool };

// Managed Postgres (Neon / Supabase / Vercel Postgres / RDS) requires TLS, but a
// local Postgres normally does not. Deciding on NODE_ENV alone (as the old
// Express code did) breaks `next start` locally against a localhost database,
// so we key off the host instead — with PGSSL as an explicit override:
//   PGSSL=true  -> always TLS
//   PGSSL=false -> never TLS
function wantsSsl(connectionString: string | undefined) {
  if (process.env.PGSSL === "true") return true;
  if (process.env.PGSSL === "false") return false;
  if (!connectionString) return false;
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return !["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"].includes(host);
  } catch {
    // Unparsable URL: fall back to the previous NODE_ENV behaviour.
    return process.env.NODE_ENV === "production";
  }
}

export const pool: Pool =
  globalForPg.__ecommercePgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: wantsSsl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
    max: 5,
  });

globalForPg.__ecommercePgPool = pool;

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL client error", err);
});

export function query(text: string, params?: unknown[]) {
  return pool.query(text, params as never[]);
}

// Transactions (the Chapa payment flow uses BEGIN/COMMIT) check a dedicated
// client out of the pool, exactly like the old Express code did via pool.connect().
export async function connect() {
  return pool.connect();
}
