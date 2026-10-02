-- =============================================================================
-- KMFRI Scientists & Research Management Dashboard (Production SQL Schema)
-- Compatible with Supabase PostgreSQL, Render PostgreSQL, and Google Cloud SQL
-- Run this script directly in the Supabase SQL Editor or via `psql $DATABASE_URL`
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- 3. Role Permissions (Composite PK)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Directorates
CREATE TABLE IF NOT EXISTS directorates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  head_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directorates_code ON directorates(code);
CREATE INDEX IF NOT EXISTS idx_directorates_head ON directorates(head_user_id);

-- 5. Research Areas
CREATE TABLE IF NOT EXISTS research_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  directorate_id UUID NOT NULL REFERENCES directorates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_areas_directorate ON research_areas(directorate_id);

-- 6. Users (Scientists, Admins, Directors, Viewers)
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

CREATE INDEX IF NOT EXISTS idx_users_directorate ON users(directorate_id);
CREATE INDEX IF NOT EXISTS idx_users_research_area ON users(research_area_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 7. Projects
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

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_projects_directorate ON projects(directorate_id);
CREATE INDEX IF NOT EXISTS idx_projects_research_area ON projects(research_area_id);
CREATE INDEX IF NOT EXISTS idx_projects_pi ON projects(principal_investigator_id);

-- 8. Project Members
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Co-Investigator',
  start_date TEXT,
  end_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 9. Project Milestones
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

CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON project_milestones(status);

-- 10. Funders
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

CREATE INDEX IF NOT EXISTS idx_funders_type ON funders(type);
CREATE INDEX IF NOT EXISTS idx_funders_country ON funders(country);

-- 11. Funding / Grants
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

CREATE INDEX IF NOT EXISTS idx_funding_project ON funding(project_id);
CREATE INDEX IF NOT EXISTS idx_funding_funder ON funding(funder_id);
CREATE INDEX IF NOT EXISTS idx_funding_status ON funding(status);
CREATE INDEX IF NOT EXISTS idx_funding_dates ON funding(award_date, start_date, end_date);

-- 12. GIS Locations (Marine, Coastal & Freshwater Stations)
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

CREATE INDEX IF NOT EXISTS idx_locations_coords ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_locations_county ON locations(county);
CREATE INDEX IF NOT EXISTS idx_locations_marine_area ON locations(marine_area);

-- 13. Project Locations (Composite PK)
CREATE TABLE IF NOT EXISTS project_locations (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  activity_description TEXT,
  PRIMARY KEY (project_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_project_locations_project ON project_locations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_locations_location ON project_locations(location_id);

-- 14. Collaborators
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

CREATE INDEX IF NOT EXISTS idx_collaborators_org_type ON collaborators(organization_type);
CREATE INDEX IF NOT EXISTS idx_collaborators_country ON collaborators(country);

-- 15. Project Collaborators (Composite PK)
CREATE TABLE IF NOT EXISTS project_collaborators (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Research Partner',
  PRIMARY KEY (project_id, collaborator_id)
);

-- 16. Reports
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

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_due_date ON reports(due_date);
CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_scientist ON reports(scientist_id);

-- 17. Research Outputs & Publications Studio
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

CREATE INDEX IF NOT EXISTS idx_outputs_type ON research_outputs(output_type);
CREATE INDEX IF NOT EXISTS idx_outputs_project ON research_outputs(project_id);
CREATE INDEX IF NOT EXISTS idx_outputs_lead_scientist ON research_outputs(lead_scientist_id);

-- 18. Output Authors (Composite PK)
CREATE TABLE IF NOT EXISTS output_authors (
  output_id UUID NOT NULL REFERENCES research_outputs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_order INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (output_id, user_id)
);

-- 19. Documents & Shared Files/Images (with SharePoint & Word Co-Authoring)
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

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- 20. Research Activities & Balanced Scorecard Events
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

CREATE INDEX IF NOT EXISTS idx_activities_project ON research_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_scientist ON research_activities(scientist_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON research_activities(activity_date);

-- 21. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- 22. Audit Logs
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- 23. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. Shared Folders (Platform-Wide File, Folder & Image Sharing)
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

CREATE INDEX IF NOT EXISTS idx_shared_folders_project ON shared_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_shared_folders_creator ON shared_folders(created_by);

-- 25. Real-Time Scientist Chat & Research Collaboration Messages
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

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- =============================================================================
-- IDEMPOTENT SCHEMA UPGRADES FOR EXISTING DATABASES
-- =============================================================================
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

-- =============================================================================
-- FOUNDATIONAL INSTITUTIONAL SEED DATA (ROLES, PERMISSIONS, DIRECTORATES)
-- =============================================================================

INSERT INTO roles (name, description) VALUES
  ('SUPER ADMIN', 'Full institutional control, system configuration, RBAC management, audit logs, and all research modules.'),
  ('ADMIN', 'Manage researchers, projects, funding, reports, collaborators, locations, and documents.'),
  ('DIRECTOR/OVERALL MANAGEMENT', 'Institution-wide analytics, strategic oversight, project approvals, and executive reporting.'),
  ('HEAD OF OCEANS & COASTAL SYSTEMS', 'Directorate-level oversight, researcher workload tracking, project approvals, and report reviews.'),
  ('SCIENTIST/RESEARCHER', 'Personal projects, research activities, milestones, outputs, reports, funding, and collaborators.'),
  ('VIEWER', 'Authorized read-only access to institutional dashboards, maps, and published outputs.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) VALUES
  ('manage_users', 'Create, update, and manage scientist and staff accounts'),
  ('manage_roles', 'Configure RBAC roles and permission assignments'),
  ('approve_projects', 'Approve, suspend, or archive research projects'),
  ('create_projects', 'Propose and manage scientific research projects'),
  ('manage_funding', 'Allocate grants, funders, and expenditure records'),
  ('review_reports', 'Review, approve, or reject technical and progress reports'),
  ('submit_reports', 'Create and submit project reports and research outputs'),
  ('manage_locations', 'Add and edit GIS marine and freshwater stations'),
  ('manage_collaborators', 'Register partner organizations and MOUs'),
  ('view_audit_logs', 'Inspect institutional audit logs and security events'),
  ('manage_settings', 'Update KMFRI institutional system configurations')
ON CONFLICT (name) DO NOTHING;

INSERT INTO directorates (name, code, description) VALUES
  ('Oceans and Coastal Systems', 'OCS', 'Marine ecology, coral reefs, mangroves, seagrass, oceanography, hydrography, and EEZ fisheries across the Kenyan Indian Ocean coast.'),
  ('Freshwater Systems', 'FWS', 'Limnology, stock assessment, and catchment ecology across Lake Victoria, Lake Turkana, Lake Naivasha, Lake Baringo, and river basins.'),
  ('Aquaculture Research & Development', 'ARD', 'Mariculture, freshwater fish farming, selective breeding, fish nutrition, and aquatic animal health.'),
  ('Socio-Economics & Blue Economy', 'SBE', 'Fisheries value-chain economics, Beach Management Unit (BMU) governance, post-harvest technology, and marine policy.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('institution_profile', '{"name":"Kenya Marine and Fisheries Research Institute (KMFRI)","headquarters":"English Point, Silos Road, Mkomani, Mombasa, Kenya","ministry":"Ministry of Mining, Blue Economy and Maritime Affairs","defaultCurrency":"KES","usdToKesRate":129.5,"reportingGraceDays":5}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
