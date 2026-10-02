import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.SUPABASE_POOLER_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  '';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
});
