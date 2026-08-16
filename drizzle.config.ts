import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const localDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export default defineConfig({
  schema: "./src/infrastructure/db/schema/**/*.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  migrations: {
    prefix: "supabase",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
  strict: true,
  verbose: true,
});
