import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSnapshot } from '../types/kmfri.ts';

// =============================================================================
// SUPABASE / POSTGRESQL MIRROR LAYER
// -----------------------------------------------------------------------------
// The JSON snapshot store (data/kmfri_db.json) remains the source of truth for
// the application. Every persisted snapshot is additionally mirrored into the
// institutional Supabase / PostgreSQL instance defined by supabase/migrations.
//
// Mirror modes (SUPABASE_MIRROR_MODE):
//   mirror (default) - upsert every snapshot row. Non-destructive: rows that
//                      only exist in Postgres are left untouched.
//   sync             - upsert every snapshot row and delete Postgres rows whose
//                      id is absent from the snapshot (JSON stays authoritative).
//
// The mirror never throws into the request path: failures are recorded in the
// module status and surfaced through GET /api/supabase/status.
// =============================================================================

type SnapshotRow = Record<string, unknown>;

interface TableSpec {
  table: string;
  key: Extract<keyof DatabaseSnapshot, string>;
  /** Database columns written by the mirror. Tables are ordered parents-first. */
  columns: string[];
  /** Snapshot field -> database column renames for fields whose names differ. */
  renames?: Record<string, string>;
  /** Columns declared NOT NULL without a default; rows missing them are skipped. */
  required: string[];
}

const IDENTITY = (
  table: TableSpec['table'],
  key: TableSpec['key'],
  columns: string[],
  required: string[],
  renames?: TableSpec['renames']
): TableSpec => ({ table, key, columns, required, renames });

// Ordered parents-first so foreign keys always resolve during the upsert pass.
const TABLE_SPECS: TableSpec[] = [
  IDENTITY('roles', 'roles',
    ['id', 'code', 'name', 'description', 'created_at', 'updated_at'],
    ['id', 'code', 'name', 'description']),
  IDENTITY('permissions', 'permissions',
    ['id', 'code', 'module', 'description', 'created_at'],
    ['id', 'code', 'module', 'description']),
  IDENTITY('role_permissions', 'role_permissions',
    ['id', 'role_id', 'permission_id', 'created_at'],
    ['id', 'role_id', 'permission_id']),
  IDENTITY('directorates', 'directorates',
    ['id', 'code', 'name', 'headquarters', 'description', 'is_active', 'created_at', 'updated_at'],
    ['id', 'code', 'name', 'headquarters', 'description']),
  IDENTITY('research_areas', 'research_areas',
    ['id', 'code', 'name', 'directorate_id', 'description', 'is_active', 'created_at', 'updated_at'],
    ['id', 'code', 'name', 'directorate_id', 'description']),
  IDENTITY('users', 'users',
    ['id', 'staff_number', 'email', 'full_name', 'title', 'position', 'role_id', 'role_code',
      'directorate_id', 'research_area_id', 'phone', 'office_station', 'orcid_id', 'specialization',
      'bio', 'avatar_url', 'is_active', 'is_operational_scientist', 'last_login_at',
      'password_reset_required', 'created_at', 'updated_at'],
    ['id', 'staff_number', 'email', 'full_name', 'title', 'position', 'role_id']),
  IDENTITY('funders', 'funders',
    ['id', 'name', 'funder_type', 'country', 'contact_person', 'contact_email', 'contact_phone',
      'website', 'created_at', 'updated_at'],
    ['id', 'name', 'funder_type', 'country']),
  IDENTITY('projects', 'projects',
    ['id', 'project_code', 'title', 'description', 'objectives', 'research_area_id', 'directorate_id',
      'principal_investigator_id', 'start_date', 'end_date', 'status', 'priority', 'budget', 'currency',
      'primary_funder_id', 'deliverables', 'progress_percent', 'risks_issues', 'is_archived',
      'approved_by', 'approved_at', 'created_at', 'updated_at'],
    ['id', 'project_code', 'title', 'description', 'research_area_id', 'directorate_id',
      'principal_investigator_id', 'start_date', 'end_date']),
  IDENTITY('project_members', 'project_members',
    ['id', 'project_id', 'user_id', 'project_role', 'allocation_percent', 'assigned_at'],
    ['id', 'project_id', 'user_id', 'project_role']),
  IDENTITY('project_milestones', 'project_milestones',
    ['id', 'project_id', 'title', 'description', 'due_date', 'completed_date', 'status',
      'progress_percent', 'owner_id', 'deliverable_summary', 'created_at', 'updated_at'],
    ['id', 'project_id', 'title', 'due_date']),
  // remaining_amount is GENERATED ALWAYS in Postgres and is therefore never written.
  IDENTITY('funding', 'funding',
    ['id', 'grant_number', 'funder_id', 'project_id', 'amount', 'currency', 'award_date',
      'start_date', 'end_date', 'allocated_amount', 'spent_amount', 'status', 'notes',
      'created_at', 'updated_at'],
    ['id', 'grant_number', 'funder_id', 'project_id', 'amount', 'award_date', 'start_date', 'end_date']),
  IDENTITY('locations', 'locations',
    ['id', 'country', 'county', 'sub_county', 'site_name', 'latitude', 'longitude',
      'marine_coastal_area', 'description', 'created_at', 'updated_at'],
    ['id', 'county', 'sub_county', 'site_name', 'latitude', 'longitude', 'marine_coastal_area']),
  IDENTITY('project_locations', 'project_locations',
    ['id', 'project_id', 'location_id', 'activity_summary', 'created_at'],
    ['id', 'project_id', 'location_id']),
  IDENTITY('collaborators', 'collaborators',
    ['id', 'organization_name', 'contact_person', 'email', 'phone', 'country', 'organization_type',
      'collaboration_type', 'agreement_start_date', 'agreement_end_date', 'mou_status', 'notes',
      'created_at', 'updated_at'],
    ['id', 'organization_name', 'contact_person', 'email', 'country', 'organization_type',
      'collaboration_type']),
  IDENTITY('project_collaborators', 'project_collaborators',
    ['id', 'project_id', 'collaborator_id', 'role_description', 'created_at'],
    ['id', 'project_id', 'collaborator_id']),
  IDENTITY('reports', 'reports',
    ['id', 'title', 'project_id', 'scientist_id', 'report_type', 'reporting_period', 'due_date',
      'submission_date', 'status', 'is_overdue', 'reviewer_id', 'reviewer_comments', 'approval_date',
      'version', 'summary', 'created_at', 'updated_at'],
    ['id', 'title', 'project_id', 'scientist_id', 'report_type', 'reporting_period', 'due_date']),
  // manuscript_sections and figure_urls are not stored as columns.
  IDENTITY('research_outputs', 'research_outputs',
    ['id', 'title', 'output_type', 'project_id', 'lead_scientist_id', 'journal_or_event', 'doi_or_url',
      'publication_date', 'abstract', 'manuscript_body', 'keywords', 'status', 'created_at', 'updated_at'],
    ['id', 'title', 'output_type', 'lead_scientist_id', 'journal_or_event', 'publication_date', 'abstract']),
  IDENTITY('output_authors', 'output_authors',
    ['id', 'output_id', 'user_id', 'external_author_name', 'affiliation', 'author_order',
      'is_corresponding', 'created_at'],
    ['id', 'output_id', 'author_order']),
  IDENTITY('shared_folders', 'shared_folders',
    ['id', 'name', 'description', 'project_id', 'directorate_id', 'created_by', 'created_by_name',
      'color', 'created_at', 'updated_at'],
    ['id', 'name', 'created_by']),
  // Check-out and Word-studio fields live only in the JSON snapshot.
  IDENTITY('documents', 'documents',
    ['id', 'title', 'file_name', 'mime_type', 'file_size_bytes', 'storage_path', 'file_data_url',
      'category', 'folder_id', 'project_id', 'report_id', 'output_id', 'funding_id',
      'collaborator_id', 'version', 'uploaded_by', 'metadata', 'created_at'],
    ['id', 'title', 'file_name', 'mime_type', 'file_size_bytes', 'storage_path', 'category',
      'project_id', 'uploaded_by'],
    { data_url: 'file_data_url' }),
  IDENTITY('research_activities', 'research_activities',
    ['id', 'project_id', 'scientist_id', 'location_id', 'activity_type', 'title', 'description',
      'activity_date', 'status', 'observations', 'created_at'],
    ['id', 'project_id', 'scientist_id', 'activity_type', 'title', 'description', 'activity_date']),
  IDENTITY('notifications', 'notifications',
    ['id', 'recipient_user_id', 'category', 'title', 'message', 'entity_type', 'entity_id',
      'is_read', 'created_at'],
    ['id', 'category', 'title', 'message']),
  IDENTITY('audit_logs', 'audit_logs',
    ['id', 'actor_user_id', 'actor_email', 'actor_role', 'action', 'entity_type', 'entity_id',
      'summary', 'metadata', 'ip_address', 'created_at'],
    ['id', 'actor_email', 'actor_role', 'action', 'entity_type', 'summary']),
  IDENTITY('system_settings', 'system_settings',
    ['id', 'setting_key', 'setting_value', 'category', 'description', 'updated_by', 'updated_at'],
    ['id', 'setting_key', 'setting_value', 'category', 'description']),
  IDENTITY('chat_messages', 'chat_messages',
    ['id', 'channel_id', 'sender_id', 'sender_name', 'sender_title', 'sender_role', 'sender_avatar',
      'sender_station', 'content', 'attachments', 'created_at'],
    ['id', 'sender_id', 'sender_name', 'sender_title', 'sender_role']),
  IDENTITY('email_dispatches', 'email_dispatches',
    ['id', 'recipient_email', 'recipient_name', 'subject', 'type', 'body_html', 'body_text',
      'status', 'sent_at', 'metadata'],
    ['id', 'recipient_email', 'recipient_name', 'subject', 'type', 'body_html', 'body_text']),
];

const UPSERT_BATCH_SIZE = 200;
const DELETE_BATCH_SIZE = 200;
const DEFAULT_DEBOUNCE_MS = 1500;

export type MirrorMode = 'mirror' | 'sync';

export interface MirrorTableResult {
  table: string;
  snapshotRows: number;
  upserted: number;
  skipped: number;
  deleted: number;
  skipReasons: Record<string, number>;
  error?: string;
}

export interface MirrorRunResult {
  mode: MirrorMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  success: boolean;
  tables: MirrorTableResult[];
  totals: { tables: number; upserted: number; skipped: number; deleted: number; failed: number };
  error?: string;
}

interface MirrorConfig {
  url: string | null;
  key: string | null;
  keyRole: 'service_role' | 'anon' | 'unknown';
  mode: MirrorMode;
  enabled: boolean;
  debounceMs: number;
  tableFilter: string[];
}

const config: MirrorConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null,
  key:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    null,
  keyRole: 'unknown',
  mode: process.env.SUPABASE_MIRROR_MODE === 'sync' ? 'sync' : 'mirror',
  enabled: process.env.SUPABASE_MIRROR_ENABLED !== 'false',
  debounceMs: Number(process.env.SUPABASE_MIRROR_DEBOUNCE_MS) > 0
    ? Number(process.env.SUPABASE_MIRROR_DEBOUNCE_MS)
    : DEFAULT_DEBOUNCE_MS,
  tableFilter: (process.env.SUPABASE_MIRROR_TABLES || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
};

function decodeKeyRole(key: string): MirrorConfig['keyRole'] {
  try {
    const payload = key.split('.')[1];
    if (!payload) return 'unknown';
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    return json.role === 'service_role' ? 'service_role' : 'anon';
  } catch {
    return 'unknown';
  }
}
config.keyRole = config.key ? decodeKeyRole(config.key) : 'unknown';

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(config.url && config.key);
}

export function isSupabaseMirrorEnabled(): boolean {
  return config.enabled && isSupabaseConfigured();
}

function getClient(): SupabaseClient {
  if (!config.url || !config.key) {
    throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (!client) {
    client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-application-name': 'kmfri-research-management' } },
    });
  }
  return client;
}

function selectedSpecs(): TableSpec[] {
  if (config.tableFilter.length === 0) return TABLE_SPECS;
  const allowed = new Set(config.tableFilter.map((t) => t.toLowerCase()));
  return TABLE_SPECS.filter((spec) => allowed.has(spec.table.toLowerCase()));
}

function projectRow(spec: TableSpec, row: SnapshotRow): { row: SnapshotRow; missing?: string } {
  const reverse: Record<string, string> = {};
  for (const [field, column] of Object.entries(spec.renames || {})) reverse[column] = field;

  const out: SnapshotRow = {};
  for (const column of spec.columns) {
    const value = row[reverse[column] ?? column];
    if (value === undefined) continue;
    out[column] = value;
  }
  for (const column of spec.required) {
    if (out[column] === undefined || out[column] === null) return { row: out, missing: column };
  }
  return { row: out };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function upsertRows(supabase: SupabaseClient, table: string, rows: SnapshotRow[]): Promise<void> {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
}

async function deleteStaleRows(
  supabase: SupabaseClient,
  table: string,
  keepIds: Set<string>
): Promise<number> {
  const { data, error } = await supabase.from(table).select('id');
  if (error) throw new Error(error.message);
  const stale = ((data || []) as Array<{ id: string }>)
    .map((r) => r.id)
    .filter((id) => !keepIds.has(id));
  if (stale.length === 0) return 0;

  let deleted = 0;
  for (const batch of chunk(stale, DELETE_BATCH_SIZE)) {
    const { error: deleteError, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in('id', batch);
    if (deleteError) throw new Error(deleteError.message);
    deleted += count ?? batch.length;
  }
  return deleted;
}

/**
 * Pushes a full database snapshot into Supabase/PostgreSQL.
 * Never throws: per-table failures are captured in the returned result.
 */
export async function mirrorSnapshotToSupabase(
  snapshot: DatabaseSnapshot,
  options: { prune?: boolean } = {}
): Promise<MirrorRunResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const prune = options.prune ?? config.mode === 'sync';
  const tables: MirrorTableResult[] = [];
  const result: MirrorRunResult = {
    mode: config.mode,
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    success: true,
    tables,
    totals: { tables: 0, upserted: 0, skipped: 0, deleted: 0, failed: 0 },
  };

  try {
    const supabase = getClient();

    for (const spec of selectedSpecs()) {
      const source = (snapshot[spec.key] || []) as unknown as SnapshotRow[];
      const tableResult: MirrorTableResult = {
        table: spec.table,
        snapshotRows: source.length,
        upserted: 0,
        skipped: 0,
        deleted: 0,
        skipReasons: {},
      };
      tables.push(tableResult);

      const payloads: SnapshotRow[] = [];
      const ids = new Set<string>();
      for (const sourceRow of source) {
        const { row, missing } = projectRow(spec, sourceRow);
        if (missing) {
          tableResult.skipped += 1;
          tableResult.skipReasons[`missing_${missing}`] =
            (tableResult.skipReasons[`missing_${missing}`] || 0) + 1;
          continue;
        }
        payloads.push(row);
        if (typeof row.id === 'string') ids.add(row.id);
      }

      try {
        if (payloads.length > 0) {
          await upsertRows(supabase, spec.table, payloads);
          tableResult.upserted = payloads.length;
        }
        if (prune) {
          tableResult.deleted = await deleteStaleRows(supabase, spec.table, ids);
        }
      } catch (tableError: any) {
        tableResult.error = tableError?.message || String(tableError);
      }
    }
  } catch (runError: any) {
    result.error = runError?.message || String(runError);
  }

  result.totals = {
    tables: tables.length,
    upserted: tables.reduce((sum, t) => sum + t.upserted, 0),
    skipped: tables.reduce((sum, t) => sum + t.skipped, 0),
    deleted: tables.reduce((sum, t) => sum + t.deleted, 0),
    failed: tables.filter((t) => t.error).length,
  };
  result.success = !result.error && result.totals.failed === 0;
  result.finishedAt = new Date().toISOString();
  result.durationMs = Date.now() - startedMs;
  return result;
}

// -----------------------------------------------------------------------------
// Scheduler: coalesces bursts of saveDatabase() calls into a single mirror run
// -----------------------------------------------------------------------------

let pendingSnapshot: DatabaseSnapshot | null = null;
let pendingTimer: NodeJS.Timeout | null = null;
let running = false;
let queued = false;

let lastResult: MirrorRunResult | null = null;
let lastError: string | null = null;
let runningSince: string | null = null;

function runPending(): Promise<MirrorRunResult | null> {
  const snapshot = pendingSnapshot;
  pendingSnapshot = null;
  if (!snapshot) return Promise.resolve(lastResult);

  running = true;
  runningSince = new Date().toISOString();
  return mirrorSnapshotToSupabase(snapshot)
    .then((result) => {
      lastResult = result;
      if (result.success) {
        lastError = null;
      } else {
        lastError = result.error || `${result.totals.failed} table(s) failed`;
      }
      if (result.error || result.totals.failed > 0) {
        console.warn(
          `[supabase] mirror finished with errors: ${lastError} (upserted=${result.totals.upserted}, skipped=${result.totals.skipped}, deleted=${result.totals.deleted})`
        );
      }
      return result;
    })
    .catch((err: any) => {
      lastError = err?.message || String(err);
      console.warn(`[supabase] mirror failed: ${lastError}`);
      return null;
    })
    .finally(() => {
      running = false;
      runningSince = null;
      if (queued) {
        queued = false;
        scheduleSupabaseMirrorRun(0);
      }
    });
}

function scheduleSupabaseMirrorRun(delayMs: number): void {
  if (!isSupabaseMirrorEnabled()) return;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (running) {
      queued = true;
      return;
    }
    void runPending();
  }, delayMs);
  pendingTimer.unref?.();
}

/** Queues a debounced mirror of the supplied snapshot. Safe to call on every save. */
export function scheduleSupabaseMirror(snapshot: DatabaseSnapshot): void {
  if (!isSupabaseMirrorEnabled()) return;
  pendingSnapshot = snapshot;
  scheduleSupabaseMirrorRun(config.debounceMs);
}

/** Runs any queued mirror immediately and resolves when it settles. */
export async function flushSupabaseMirror(): Promise<MirrorRunResult | null> {
  if (!isSupabaseMirrorEnabled()) return null;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (running) {
    queued = false;
    return lastResult;
  }
  return runPending();
}

export interface SupabaseStatus {
  configured: boolean;
  enabled: boolean;
  mode: MirrorMode;
  url: string | null;
  keyRole: MirrorConfig['keyRole'];
  debounceMs: number;
  tables: string[];
  inFlight: boolean;
  runningSince: string | null;
  pending: boolean;
  lastResult: MirrorRunResult | null;
  lastError: string | null;
}

/** Configuration and last-run telemetry for the mirror, without any secrets. */
export function getSupabaseMirrorStatus(): SupabaseStatus {
  return {
    configured: isSupabaseConfigured(),
    enabled: isSupabaseMirrorEnabled(),
    mode: config.mode,
    url: config.url,
    keyRole: config.keyRole,
    debounceMs: config.debounceMs,
    tables: selectedSpecs().map((s) => s.table),
    inFlight: running,
    runningSince,
    pending: pendingSnapshot !== null,
    lastResult,
    lastError,
  };
}

/** Round-trips a lightweight query to confirm the database is reachable. */
export async function checkSupabaseConnection(): Promise<{
  reachable: boolean;
  message: string;
  latencyMs: number | null;
}> {
  if (!isSupabaseConfigured()) {
    return { reachable: false, message: 'Supabase credentials are not configured.', latencyMs: null };
  }
  const startedMs = Date.now();
  try {
    const { error } = await getClient().from('system_settings').select('id').limit(1);
    const latencyMs = Date.now() - startedMs;
    if (error) return { reachable: false, message: error.message, latencyMs };
    return { reachable: true, message: 'Connected', latencyMs };
  } catch (err: any) {
    return {
      reachable: false,
      message: err?.message || String(err),
      latencyMs: Date.now() - startedMs,
    };
  }
}