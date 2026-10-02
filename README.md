# KMFRI Scientists & Research Management Dashboard

Standalone institutional research management, project governance, grant tracking, SharePoint & Microsoft Word Online document collaboration, Scientist Balanced Scorecard (BSC), and GIS hydrographic station portal for the **Kenya Marine and Fisheries Research Institute (KMFRI)**.

---

## 1. Standalone Architecture (Render + Supabase Only)

- **Database**: **Supabase PostgreSQL** (`DATABASE_URL` via Session/Transaction Pooler) with 25 normalized tables, UUID primary keys, foreign key relationships, composite primary keys, JSONB columns (`audit_logs`, `system_settings`), and B-tree indexes. Includes automatic local failover to an embedded persistent PostgreSQL 16 engine (`@electric-sql/pglite` in `./.kmfri-local-db`) if the remote database host is unreachable on an IPv4-only local network.
- **ORM & Migrations**: Drizzle ORM (`src/db/schema.ts`, `src/db/index.ts`, `supabase/migrations/0001_kmfri_schema_and_seed.sql`).
- **Standalone Authentication**: Built-in `scrypt` password hashing and HMAC-SHA256 signed session tokens (`src/lib/password.ts`, `src/middleware/auth.ts`, `src/context/AuthContext.tsx`) with self-service scientist password reset and zero Firebase dependencies.
- **Backend & Hosting**: Node.js + Express + WebSocket Hub (`server.ts`) ready for deployment on **Render** (`render.yaml`).
- **Frontend**: React 19 + TypeScript + Tailwind CSS + Leaflet GIS + Lucide Icons.

---

## 2. Primary Modules

1. **Overall Institutional, Personal Scientist & Head of OCS Dashboards (`src/components/DashboardsView.tsx`)**
2. **Scientist Balanced Scorecard & Related Events (`src/components/BalancedScorecardView.tsx`)**:
   - 100-point institutional evaluation across 4 pillars: Research Project Execution (35%), Publications & Co-Authored Outputs (25%), Financial & Grant Stewardship (20%), and Cruises, Field Expeditions & Scientific Events (20%).
3. **SharePoint Document Library & Word Online Co-Authoring Studio (`src/components/SharedDriveView.tsx`)**:
   - Team Site document libraries, Check-Out/Check-In version locking, approval status workflows, and a live Microsoft Word Online editor.
4. **Project Management & 11-Tab Workspace (`src/components/ProjectDetailModal.tsx`)**
5. **Funding & Grants, Technical Reports Workflow, GIS Station Mapping (`src/components/InteractiveMap.tsx`), Collaborators & Publications Studio (`src/components/PublicationsStudioView.tsx`)**
6. **System Administration & JSONB Audit Trail (`src/components/AdministrationView.tsx`)**
