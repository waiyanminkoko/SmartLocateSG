import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
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
  const databaseUser = process.env.SUPABASE_DB_USER || "postgres";
  const databaseName = process.env.SUPABASE_DB_NAME || "postgres";
  const databasePort = process.env.SUPABASE_DB_PORT || "5432";

  if (!supabaseUrl || !databasePassword) {
    return null;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split(".")[0];

    if (!projectRef) {
      return null;
    }

    return `postgresql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}@db.${projectRef}.supabase.co:${databasePort}/${databaseName}`;
  } catch {
    return null;
  }
}

const databaseUrl = process.env.DATABASE_URL || buildSupabaseDatabaseUrl();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Either export DATABASE_URL or keep VITE_SUPABASE_URL in .env and set SUPABASE_DB_PASSWORD in your terminal.",
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "../shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
