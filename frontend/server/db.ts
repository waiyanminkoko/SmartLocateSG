import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as sharedSchemaNs from '../../shared/schema';
import * as schemaModule from '@shared/schema';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const schema = ((schemaModule as { default?: typeof schemaModule }).default ?? schemaModule) as typeof schemaModule;

// Load environment variables from either workspace root or parent folder
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

function buildSupabaseDatabaseUrl() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  const databasePassword = process.env.SUPABASE_DB_PASSWORD?.trim();
  const preferredHost = process.env.SUPABASE_DB_HOST?.trim();
  const poolerHost = process.env.SUPABASE_POOLER_HOST?.trim();
  const usePooler = process.env.SUPABASE_USE_POOLER?.trim() === 'true';
  const poolerRegion = process.env.SUPABASE_POOLER_REGION?.trim();
  const databaseName = process.env.SUPABASE_DB_NAME?.trim() || 'postgres';
  const sslMode = process.env.SUPABASE_DB_SSLMODE?.trim() || 'require';
  const allowSelfSigned =
    process.env.SUPABASE_DB_ALLOW_SELF_SIGNED?.trim() === 'true';

  if (!supabaseUrl || !databasePassword) {
    return null;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split('.')[0];

    if (!projectRef) {
      return null;
    }

    // Legacy logic (kept for rollback/debugging with older team setup):
    // const databaseUser = process.env.SUPABASE_DB_USER || 'postgres';
    // const databaseName = process.env.SUPABASE_DB_NAME || 'postgres';
    // const databasePort = process.env.SUPABASE_DB_PORT || '5432';
    // return `postgresql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}@db.${projectRef}.supabase.co:${databasePort}/${databaseName}`;

    const inferredPoolerHost =
      usePooler && poolerRegion
        ? `aws-0-${poolerRegion}.pooler.supabase.com`
        : null;
    const resolvedHost =
      preferredHost || poolerHost || inferredPoolerHost || `db.${projectRef}.supabase.co`;
    const databaseUser =
      process.env.SUPABASE_DB_USER?.trim() ||
      (resolvedHost.includes('.pooler.supabase.com')
        ? `postgres.${projectRef}`
        : 'postgres');
    const databasePort =
      process.env.SUPABASE_DB_PORT?.trim() ||
      (resolvedHost.includes('.pooler.supabase.com') ? '6543' : '5432');

    const effectiveSslMode = allowSelfSigned ? 'no-verify' : sslMode;

    // Legacy SSL mode logic (kept for rollback/debugging):
    // const effectiveSslMode = sslMode;

    return `postgresql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}@${resolvedHost}:${databasePort}/${databaseName}?sslmode=${encodeURIComponent(effectiveSslMode)}`;
  } catch {
    return null;
  }
}

const supabaseOverrideRequested = Boolean(
  process.env.SUPABASE_DB_HOST ||
    process.env.SUPABASE_POOLER_HOST ||
    process.env.SUPABASE_USE_POOLER ||
    process.env.SUPABASE_POOLER_REGION ||
    process.env.SUPABASE_DB_USER ||
    process.env.SUPABASE_DB_PORT ||
    process.env.SUPABASE_DB_NAME ||
    process.env.SUPABASE_DB_SSLMODE ||
    process.env.SUPABASE_DB_ALLOW_SELF_SIGNED,
);

const derivedConnectionString = buildSupabaseDatabaseUrl();

const connectionString =
  process.env.SUPABASE_DATABASE_URL?.trim() ||
  (supabaseOverrideRequested ? derivedConnectionString : null) ||
  process.env.DATABASE_URL?.trim() ||
  derivedConnectionString;

// Legacy precedence (kept for rollback/debugging):
// const connectionString =
//   process.env.SUPABASE_DATABASE_URL?.trim() ||
//   process.env.DATABASE_URL?.trim() ||
//   buildSupabaseDatabaseUrl();

export const hasDatabaseConnection = Boolean(connectionString);

const connectionTimeoutMillis = Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? '15000');
const queryTimeoutMillis = Number(process.env.PG_QUERY_TIMEOUT_MS ?? '20000');

export const pool = connectionString
  ? new Pool({
      connectionString,
      connectionTimeoutMillis,
      query_timeout: queryTimeoutMillis,
    })
  : null;

// Legacy pool setup (kept for rollback/debugging):
// export const pool = new Pool({ connectionString });

export const db = (pool ? drizzle(pool, { schema }) : null) as ReturnType<typeof drizzle>;
