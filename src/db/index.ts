import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import * as schema from './schema.ts';

dotenv.config();

// Security guard: automatically remove any leftover debug-pool.ts script containing plaintext credentials
try {
  for (const unsafeFile of ['debug-pool.ts', 'debug-pool.js', 'debug-db.ts']) {
    const fullPath = path.resolve(process.cwd(), unsafeFile);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.warn(`[Security] Removed plaintext debug script: ${unsafeFile}`);
    }
  }
} catch {
  // Ignore filesystem permission errors in read-only containers
}

export function redactConnectionString(connStr: string): string {
  if (!connStr) return '';
  return connStr.replace(/(:\/\/[^:/?#]+:)([^@]+)(@)/, '$1***REDACTED***$3');
}

function extractSupabaseProjectRef(): string | null {
  const supUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const match = supUrl.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (match?.[1]) return match[1];

  const rawDb =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    '';
  const dbMatch = rawDb.match(/@db\.([a-z0-9-]+)\.supabase\.co/i);
  return dbMatch?.[1] || null;
}

export function normalizeConnectionString(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (
    !cleaned ||
    cleaned.includes('[PROJECT-REF]') ||
    cleaned.includes('YOUR-PASSWORD')
  ) {
    return '';
  }

  const projectRef = extractSupabaseProjectRef();

  try {
    const parsed = new URL(cleaned);
    // 1. If SUPABASE_POOLER_HOST is explicitly provided and URL still uses direct db.<ref>.supabase.co
    const poolerHost = (process.env.SUPABASE_POOLER_HOST || '').trim();
    if (
      poolerHost &&
      parsed.hostname.startsWith('db.') &&
      parsed.hostname.endsWith('.supabase.co')
    ) {
      parsed.hostname = poolerHost;
      parsed.port = (process.env.SUPABASE_POOLER_PORT || '5432').trim();
      if (projectRef && parsed.username === 'postgres') {
        parsed.username = `postgres.${projectRef}`;
      }
      return parsed.toString();
    }

    // 2. If URL already points to *.pooler.supabase.com, ensure username includes .<project-ref>
    if (
      parsed.hostname.endsWith('.pooler.supabase.com') &&
      projectRef &&
      parsed.username === 'postgres'
    ) {
      parsed.username = `postgres.${projectRef}`;
      return parsed.toString();
    }
  } catch {
    // Return cleaned string as-is if URL parsing fails
  }

  return cleaned;
}

const SCHEMA_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS directorates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  head_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT NOT NULL UNIQUE,
  auth_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  staff_number TEXT UNIQUE,
  profile_photo TEXT,
  position TEXT,
  directorate_id UUID REFERENCES directorates(id) ON DELETE SET NULL,
  research_area_id UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  objectives TEXT,
  deliverables TEXT,
  risks_issues TEXT,
  research_area_id UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  directorate_id UUID REFERENCES directorates(id) ON DELETE SET NULL,
  principal_investigator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Proposed',
  priority TEXT NOT NULL DEFAULT 'Medium',
  budget NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  location_summary TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Co-Investigator',
  start_date TEXT,
  end_date TEXT
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT NOT NULL,
  completion_date TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Kenya',
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  website TEXT
);

CREATE TABLE IF NOT EXISTS funding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  funder_id UUID NOT NULL REFERENCES funders(id) ON DELETE RESTRICT,
  grant_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  award_date TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  spent_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Kenya',
  county TEXT NOT NULL,
  sub_county TEXT,
  site TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  marine_area TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_locations (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  activity_description TEXT,
  PRIMARY KEY (project_id, location_id)
);

CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  country TEXT NOT NULL DEFAULT 'Kenya',
  organization_type TEXT NOT NULL,
  collaboration_type TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  mou_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_collaborators (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Research Partner',
  PRIMARY KEY (project_id, collaborator_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scientist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL,
  reporting_period TEXT NOT NULL,
  submission_date TEXT,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  review_comments TEXT,
  approval_date TEXT,
  file_url TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  output_type TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  lead_scientist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  journal_or_event TEXT,
  doi TEXT,
  url TEXT,
  publication_date TEXT NOT NULL,
  abstract TEXT,
  manuscript_body TEXT,
  keywords TEXT,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'Published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS output_authors (
  output_id UUID NOT NULL REFERENCES research_outputs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_order INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (output_id, user_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  description TEXT,
  content_body TEXT,
  sharepoint_status TEXT NOT NULL DEFAULT 'Published',
  checked_out_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_size TEXT NOT NULL DEFAULT '0 KB',
  version TEXT NOT NULL DEFAULT '1.0',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  scientist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'Field Expedition',
  description TEXT,
  activity_date TEXT NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Completed',
  hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  score_weight INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Research Workspace',
  parent_folder_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL DEFAULT 'general-research',
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  linked_output_id UUID REFERENCES research_outputs(id) ON DELETE SET NULL,
  linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id TEXT;
ALTER TABLE funding ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE funding ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE locations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE research_outputs ADD COLUMN IF NOT EXISTS manuscript_body TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'application/octet-stream';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_body TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sharepoint_status TEXT NOT NULL DEFAULT 'Published';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS checked_out_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE research_activities ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'Field Expedition';
ALTER TABLE research_activities ADD COLUMN IF NOT EXISTS score_weight INTEGER NOT NULL DEFAULT 10;
ALTER TABLE research_activities ALTER COLUMN project_id DROP NOT NULL;
`;

declare global {
  var _postgresPool: Pool | undefined;
  var _pgliteClient: PGlite | undefined;
}

const forceLocalDb =
  process.env.FORCE_LOCAL_DB === 'true' ||
  process.argv.includes('--local-db');

// Standalone Render + Supabase connection string resolution (no Cloud SQL / Firebase)
const resolvedConnectionString = forceLocalDb
  ? ''
  : normalizeConnectionString(
      process.env.SUPABASE_POOLER_URL ||
        process.env.DATABASE_POOLER_URL ||
        process.env.DATABASE_URL ||
        process.env.SUPABASE_DB_URL ||
        process.env.POSTGRES_URL
    );

let activeDb: any = null;
let activeDbMode: 'supabase-postgresql' | 'embedded-pglite-postgresql' =
  resolvedConnectionString
    ? 'supabase-postgresql'
    : 'embedded-pglite-postgresql';
let fallbackReason: string | null = null;
let dbReadyPromise: Promise<void> | null = null;

async function initEmbeddedPgliteFallback(reason: string) {
  fallbackReason = reason;
  if (!global._pgliteClient) {
    try {
      const dataDir = path.resolve(process.cwd(), '.kmfri-local-db');
      global._pgliteClient = new PGlite(dataDir);
      await global._pgliteClient.waitReady;
    } catch {
      global._pgliteClient = new PGlite();
      await global._pgliteClient.waitReady;
    }
  }
  await global._pgliteClient.exec(SCHEMA_BOOTSTRAP_SQL);
  activeDb = drizzlePglite(global._pgliteClient, { schema });
  activeDbMode = 'embedded-pglite-postgresql';
}

export const createPool = () => {
  if (!global._postgresPool) {
    if (resolvedConnectionString) {
      const isLocal =
        resolvedConnectionString.includes('localhost') ||
        resolvedConnectionString.includes('127.0.0.1');
      global._postgresPool = new Pool({
        connectionString: resolvedConnectionString,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        max: 15,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 30000,
        keepAlive: true,
      });
    } else {
      global._postgresPool = new Pool({
        max: 1,
        connectionTimeoutMillis: 1000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err.message);
    });

    // Wrap pool.query with automatic retry on transient connection drop and seamless failover to PGlite
    const rawQuery = global._postgresPool.query.bind(global._postgresPool);
    (global._postgresPool as any).query = async (...args: any[]) => {
      if (typeof args[args.length - 1] === 'function') {
        return (rawQuery as any)(...args);
      }
      try {
        return await (rawQuery as any)(...args);
      } catch (err: any) {
        const msg = String(err?.message || err?.code || '');
        const isConnError =
          msg.includes('Connection terminated') ||
          msg.includes('connection timeout') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('ECONNRESET') ||
          msg.includes('ECONNREFUSED') ||
          msg.includes('ENOTFOUND') ||
          msg.includes('EAI_AGAIN') ||
          msg.includes('Client has encountered a connection error');

        if (!isConnError) {
          throw err;
        }

        try {
          return await (rawQuery as any)(...args);
        } catch (retryErr: any) {
          await initEmbeddedPgliteFallback(
            String(retryErr?.message || 'Remote PostgreSQL connection lost')
          );
          if (global._pgliteClient) {
            const firstArg = args[0];
            const sqlText =
              typeof firstArg === 'string' ? firstArg : firstArg?.text;
            const sqlParams =
              typeof firstArg === 'string'
                ? Array.isArray(args[1])
                  ? args[1]
                  : []
                : Array.isArray(firstArg?.values)
                  ? firstArg.values
                  : [];
            if (sqlText) {
              return await global._pgliteClient.query(sqlText, sqlParams, {
                rowMode: firstArg?.rowMode === 'array' ? 'array' : 'object',
              });
            }
          }
          throw retryErr;
        }
      }
    };
  }
  return global._postgresPool;
};

const pool = createPool();
const pgDrizzleDb = drizzle(pool, { schema });
activeDb = pgDrizzleDb;

export async function ensureDbReady(): Promise<void> {
  if (dbReadyPromise) {
    return dbReadyPromise;
  }

  dbReadyPromise = (async () => {
    // If FORCE_LOCAL_DB / --local-db is set, or no Supabase DATABASE_URL is configured, use embedded PGlite immediately
    if (forceLocalDb || !resolvedConnectionString) {
      await initEmbeddedPgliteFallback(
        forceLocalDb
          ? 'Local DB mode explicitly requested (--local-db / FORCE_LOCAL_DB=true).'
          : 'No remote Supabase DATABASE_URL configured; using embedded persistent PostgreSQL (.kmfri-local-db).'
      );
      return;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const probePromise = pool.query('SELECT 1');
      probePromise.catch(() => {});

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Primary Supabase PostgreSQL connection timed out (5s)')),
          5000
        );
      });
      await Promise.race([probePromise, timeoutPromise]);

      if (activeDbMode === 'supabase-postgresql') {
        try {
          await pool.query(SCHEMA_BOOTSTRAP_SQL);
        } catch (migrationErr: any) {
          console.warn(
            '[KMFRI DB] Non-fatal schema upgrade warning on Supabase PostgreSQL:',
            migrationErr?.message || migrationErr
          );
        }
      }
    } catch (connError: any) {
      const errMsg = String(connError?.code || connError?.message || 'Unreachable host');
      console.warn(
        `[KMFRI DB] Supabase PostgreSQL unreachable (${errMsg}) for ${redactConnectionString(
          resolvedConnectionString
        )}. Automatically activating embedded persistent PostgreSQL (PGlite) at ./.kmfri-local-db.`
      );
      await initEmbeddedPgliteFallback(errMsg);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  })();

  return dbReadyPromise;
}

export function getDbStatus() {
  return {
    databaseProvider: activeDbMode,
    configuredTarget: redactConnectionString(
      resolvedConnectionString || 'embedded-pglite (.kmfri-local-db)'
    ),
    fallbackReason,
  };
}

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_target, prop, receiver) {
      const value = Reflect.get(activeDb, prop, receiver);
      return typeof value === 'function' ? value.bind(activeDb) : value;
    },
  }
);
