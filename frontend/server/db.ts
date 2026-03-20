import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
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
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const databasePassword = process.env.SUPABASE_DB_PASSWORD;
  const databaseUser = process.env.SUPABASE_DB_USER || 'postgres';
  const databaseName = process.env.SUPABASE_DB_NAME || 'postgres';
  const databasePort = process.env.SUPABASE_DB_PORT || '5432';

  if (!supabaseUrl || !databasePassword) {
    return null;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split('.')[0];

    if (!projectRef) {
      return null;
    }

    return `postgresql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}@db.${projectRef}.supabase.co:${databasePort}/${databaseName}`;
  } catch {
    return null;
  }
}

const connectionString = process.env.DATABASE_URL || buildSupabaseDatabaseUrl();

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Either provide DATABASE_URL directly or keep VITE_SUPABASE_URL in .env and set SUPABASE_DB_PASSWORD in your terminal before starting the server.',
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
