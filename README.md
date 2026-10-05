# KMFRI Scientists & Research Management System

Production-grade web platform for the **Kenya Marine and Fisheries Research Institute (KMFRI)** to manage research scientists, multi-directorate projects, grant funding, technical reports, GIS coastal/marine sampling stations, institutional collaborators, peer-reviewed research outputs, document versioning, and RBAC governance.

---

## Core Architecture & Features

1. **Strict Non-Operational Seeding Policy**
   - Seeds **only** non-operational reference data:
     - 6 RBAC Roles (`SUPER ADMIN`, `ADMIN`, `DIRECTOR / OVERALL MANAGEMENT`, `HEAD OF OCEANS & COASTAL SYSTEMS`, `SCIENTIST / RESEARCHER`, `VIEWER`)
     - 17 Granular Permissions & Role-Permission mappings
     - 5 Official KMFRI Directorates (`OCS`, `FWS`, `ARD`, `SPG`, `LAB`)
     - 8 Official KMFRI Research Areas
     - Institutional System Settings
   - Operational tables (`projects`, `funding`, `reports`, `locations`, `collaborators`, `research_outputs`, `documents`, `research_activities`, and operational `scientists`) start completely **empty** with domain-native empty states and direct creation workflows.

2. **Role-Based Access Control (RBAC) & Security**
   - Email/Password authentication with password reset workflow and session verification.
   - Server-enforced RBAC middleware on every mutation (`/api/*`).
   - Role-aware redirects after login (e.g., `HEAD OF OCEANS & COASTAL SYSTEMS` lands on the Oceans & Coastal Systems Directorate view; `SCIENTIST / RESEARCHER` lands on the Scientist Workspace).
   - Immutable **Audit Logs** (`audit_logs`) recording actor, role, action, entity type, UUID, and JSON metadata for all create/update/delete/approve/reset/deactivate operations.

3. **11 Integrated Modules**
   - **Dashboard**: Institution-wide KPIs, Recharts analytics, GIS map, filter bar (Year, Directorate, Scientist, Status, Funder, Research Area), interactive drill-down (`KPI → Project → Scientist → Activity/Report`), plus dedicated **Head of Oceans & Coastal Systems** and **Scientist** dashboards.
   - **Scientists**: Researcher directory, profile management, account activation/deactivation, password reset, and full **Scientist Dedicated Dashboard**.
   - **Projects**: Full lifecycle management (`Proposed`, `Approved`, `In Progress`, `Suspended`, `Completed`, `Cancelled`) with 11-tab project workspace (`Overview`, `Team`, `Timeline`, `Budget`, `Funding`, `Locations`, `Collaborators`, `Milestones`, `Reports`, `Documents`, `Activity`).
   - **Funding**: Funders and grant awards (`grant_number` uniqueness), allocated/spent/remaining tracking, and multi-dimensional financial analytics.
   - **Reports**: Workflow engine (`Draft → Submitted → Under Review → Approved / Rejected`), version increments, reviewer comments, and automated overdue detection.
   - **Locations (GIS)**: Interactive Leaflet map of Kenyan marine, coastal, and inland stations with coordinate click-picker, popups, and area filters.
   - **Collaborators**: Partner institutions, MOUs, agreement dates, and linked projects.
   - **Research Outputs**: Publications, Technical Reports, Datasets, and Presentations with ordered multi-author tracking (`output_authors`).
   - **Documents**: File upload with MIME/size validation, versioning, and category filters.
   - **Notifications**: Automated deadline, workflow, assignment, and institutional broadcast notifications.
   - **Administration**: Users, Roles/Permissions matrix, Directorates, Research Areas, System Settings, Audit Logs, CSV/Excel/PDF Exports, and SQL Schema Inspector.

---

## Supabase / PostgreSQL Mirror

The JSON snapshot store (`data/kmfri_db.json`) remains the source of truth. Every
`saveDatabase()` call additionally mirrors the full snapshot into Supabase through
`src/server/supabase.ts`:

- `@supabase/supabase-js` client built from `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- Tables are upserted parents-first (`roles` → … → `email_dispatches`) so foreign keys resolve.
- Per-table column allowlists mirror the SQL schema exactly; snapshot-only fields (document
  check-out, Word Studio, `figure_urls`) and the Postgres generated column
  `funding.remaining_amount` are never written.
- Rows missing a `NOT NULL` column are skipped and reported rather than failing the whole batch.
- Mirror runs are debounced (default 1500 ms), serialized, drained on `SIGINT`/`SIGTERM`, and
  never throw into a request. Failures surface via `GET /api/supabase/status`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | – | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | – | Server-side key used for the mirror |
| `SUPABASE_MIRROR_ENABLED` | `true` | Set `false` to run JSON-only |
| `SUPABASE_MIRROR_MODE` | `mirror` | `mirror` upserts only; `sync` also deletes Postgres rows absent from the snapshot |
| `SUPABASE_MIRROR_DEBOUNCE_MS` | `1500` | Debounce window for mirror runs |
| `SUPABASE_MIRROR_TABLES` | all | Comma-separated allowlist, e.g. `projects,reports` |

### Endpoints

- `GET /api/supabase/status` — configuration, reachability, and last mirror run (any authenticated user).
- `POST /api/supabase/sync` — force a mirror run (`{ "prune": true }` to also delete stale rows); requires `settings:manage`.

---

## Security & Production Deployment

### Authentication

- **No password is hardcoded in source.** Bootstrap and system accounts get their password
  from `KMFRI_INITIAL_ADMIN_PASSWORD`, or a strong random password that is generated once and
  printed to the server log. Read it from the first boot and change it after signing in.
- Passwords are hashed with **scrypt** and a per-credential random salt. Credential hashes
  written by earlier salted-SHA256 installs still authenticate and are silently upgraded to
  scrypt on the next successful sign-in.
- Sessions are **stateless HMAC-signed tokens**, so deploys and restarts no longer sign every
  user out. Set `SESSION_SECRET` in production — without it a random key is generated at boot
  and restarts invalidate all sessions. Tokens expire after `SESSION_TTL_HOURS` (default 12).
- The "Switch Active Session Role" RBAC verification menu is **disabled by default**. It grants
  role sessions, so it requires both a signed-in `SUPER_ADMIN` and `KMFRI_ALLOW_ROLE_SWITCH=true`.
- `data/` is git-ignored: it holds credential hashes, audit trails, notifications and dispatched
  email bodies, and must never be committed.

### Deploying to Render

`render.yaml` is a ready blueprint (build `npm ci --legacy-peer-deps`, start `node dist/server.js`,
health check `/api/health`). Before the first deploy:

1. Create the service from the blueprint, or set the build/start commands manually.
2. Set the secrets in the dashboard — they are deliberately not in the repository:
   `SESSION_SECRET`, `KMFRI_INITIAL_ADMIN_PASSWORD`, `GEMINI_API_KEY`, and the
   `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` pair if the mirror is enabled.
3. The JSON store lives on a **Persistent Disk** mounted at `/data` with `KMFRI_DATA_DIR=/data`.
   Render's default filesystem is ephemeral, so without the disk every deploy discards all
   institutional records. Disks require a paid instance type; on a free instance leave
   `KMFRI_DATA_DIR` unset and enable the Supabase mirror so records are recoverable from Postgres.
4. `render.yaml` pins `NODE_VERSION=22.18.0` so the TypeScript bootstrap in `server.ts` runs.

---

## Database Setup & Migrations

### PostgreSQL / Supabase Migrations
Run the SQL migration and reference seed scripts against your Supabase / PostgreSQL instance:

```bash
psql "$POSTGRES_URL" -f supabase/reset_legacy_schema.sql   # destructive, only if the project already has conflicting tables
psql "$POSTGRES_URL" -f supabase/migrations/0001_kmfri_schema.sql
psql "$POSTGRES_URL" -f supabase/seed.sql
```

`0001_kmfri_schema.sql` uses `CREATE TABLE IF NOT EXISTS`. If the target project already
contains these table names in an older shape, those tables are skipped silently and the
migration fails part-way (for example `ERROR: 42703: column "is_overdue" does not exist`).
Run `reset_legacy_schema.sql` once beforehand to drop the conflicting tables — it deletes all
rows in them and reference data is then restored by `seed.sql` and the mirror.

### Local Development & Production Deployment

```bash
# Install dependencies
npm install

# Start full-stack development server on port 3000
npm run dev

# Type-check and build production bundle
npm run lint
npm run build

# Start production server
npm start
```
