-- =============================================================================
-- KMFRI Scientists & Research Management System
-- Production PostgreSQL / Supabase Schema Migration (0001_kmfri_schema.sql)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ROLES & PERMISSIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

-- -----------------------------------------------------------------------------
-- 2. DIRECTORATES & RESEARCH AREAS (REFERENCE TABLES)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.directorates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  headquarters TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.research_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  directorate_id UUID NOT NULL REFERENCES public.directorates(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. USERS / SCIENTISTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  staff_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Dr.',
  position TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  role_code TEXT NOT NULL DEFAULT 'SCIENTIST',
  directorate_id UUID REFERENCES public.directorates(id) ON DELETE SET NULL,
  research_area_id UUID REFERENCES public.research_areas(id) ON DELETE SET NULL,
  phone TEXT,
  office_station TEXT NOT NULL DEFAULT 'Mombasa Headquarters',
  orcid_id TEXT,
  specialization TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_operational_scientist BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. FUNDERS & PROJECTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  funder_type TEXT NOT NULL CHECK (funder_type IN ('Government', 'Bilateral', 'Multilateral', 'Foundation', 'Private', 'Internal')),
  country TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  research_area_id UUID NOT NULL REFERENCES public.research_areas(id) ON DELETE RESTRICT,
  directorate_id UUID NOT NULL REFERENCES public.directorates(id) ON DELETE RESTRICT,
  principal_investigator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Proposed' CHECK (status IN ('Proposed', 'Approved', 'In Progress', 'Suspended', 'Completed', 'Cancelled')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  budget NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  currency TEXT NOT NULL DEFAULT 'KES' CHECK (currency IN ('KES', 'USD', 'EUR', 'GBP')),
  primary_funder_id UUID REFERENCES public.funders(id) ON DELETE SET NULL,
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  risks_issues TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_project_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'Co-Investigator' CHECK (project_role IN ('Principal Investigator', 'Co-Investigator', 'Research Associate', 'Field Technologist', 'Data Analyst')),
  allocation_percent INTEGER NOT NULL DEFAULT 25 CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Delayed')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  deliverable_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. FUNDING GRANTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_number TEXT NOT NULL UNIQUE,
  funder_id UUID NOT NULL REFERENCES public.funders(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'KES' CHECK (currency IN ('KES', 'USD', 'EUR', 'GBP')),
  award_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  spent_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  remaining_amount NUMERIC(15, 2) GENERATED ALWAYS AS (allocated_amount - spent_amount) STORED,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Pending', 'Active', 'Closed', 'Suspended')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. GIS LOCATIONS & PROJECT LOCATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL DEFAULT 'Kenya',
  county TEXT NOT NULL,
  sub_county TEXT NOT NULL,
  site_name TEXT NOT NULL,
  latitude NUMERIC(9, 6) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude NUMERIC(9, 6) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  marine_coastal_area TEXT NOT NULL CHECK (marine_coastal_area IN ('Inshore Reef', 'Mangrove Creek', 'EEZ Offshore', 'Estuary', 'Seagrass Meadow', 'Freshwater Lake', 'Riverine Basin', 'Aquaculture Station')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  activity_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_location UNIQUE (project_id, location_id)
);

-- -----------------------------------------------------------------------------
-- 7. COLLABORATORS & PROJECT COLLABORATORS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL UNIQUE,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('University', 'Research Institute', 'Government Agency', 'NGO', 'International Body', 'Private Sector')),
  collaboration_type TEXT NOT NULL CHECK (collaboration_type IN ('Joint Research', 'Funding Partner', 'Capacity Building', 'Data Exchange', 'Equipment Sharing', 'Policy Advisory')),
  agreement_start_date DATE,
  agreement_end_date DATE,
  mou_status TEXT NOT NULL DEFAULT 'Active' CHECK (mou_status IN ('Draft', 'Active', 'Expired', 'Renewal Pending')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  role_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_collaborator UNIQUE (project_id, collaborator_id)
);

-- -----------------------------------------------------------------------------
-- 8. REPORTS (WITH WORKFLOW & OVERDUE TRACKING)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scientist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  report_type TEXT NOT NULL CHECK (report_type IN ('Quarterly Progress', 'Annual Technical', 'Financial Audit', 'Field Expedition', 'Final Completion')),
  reporting_period TEXT NOT NULL,
  due_date DATE NOT NULL,
  submission_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected')),
  is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewer_comments TEXT,
  approval_date TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. RESEARCH OUTPUTS & OUTPUT AUTHORS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  output_type TEXT NOT NULL CHECK (output_type IN ('Publication', 'Technical Report', 'Dataset', 'Presentation')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  lead_scientist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  journal_or_event TEXT NOT NULL,
  doi_or_url TEXT,
  publication_date DATE NOT NULL,
  abstract TEXT NOT NULL,
  manuscript_body TEXT,
  manuscript_sections JSONB DEFAULT '{}'::jsonb,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Under Peer Review', 'Published', 'Archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.output_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  output_id UUID NOT NULL REFERENCES public.research_outputs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  external_author_name TEXT,
  affiliation TEXT,
  author_order INTEGER NOT NULL CHECK (author_order >= 1),
  is_corresponding BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_output_author_order UNIQUE (output_id, author_order)
);

-- -----------------------------------------------------------------------------
-- 10. SHARED FOLDERS, DOCUMENTS, LIVE CHAT, RESEARCH ACTIVITIES, NOTIFICATIONS, AUDIT LOGS, SETTINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  parent_folder_id UUID REFERENCES public.shared_folders(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  directorate_id UUID REFERENCES public.directorates(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_by_name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'sky',
  is_shared BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  storage_path TEXT NOT NULL,
  file_data_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('Project Document', 'Report Attachment', 'Research Output', 'Funding Agreement', 'MOU Agreement')),
  folder_id UUID REFERENCES public.shared_folders(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  output_id UUID REFERENCES public.research_outputs(id) ON DELETE CASCADE,
  funding_id UUID REFERENCES public.funding(id) ON DELETE CASCADE,
  collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.research_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scientist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('Field Sampling', 'Cruise Expedition', 'Lab Analysis', 'Stakeholder Workshop', 'Data Modeling', 'Milestone Review')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  activity_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Planned', 'Ongoing', 'Completed', 'Cancelled')),
  observations JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('Account', 'Assignment', 'Project Approval', 'Report Deadline', 'Report Submission', 'Report Review', 'Milestone', 'Funding', 'Announcement')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL DEFAULT 'general-research',
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_title TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  sender_avatar TEXT,
  sender_station TEXT,
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('LOGIN_ALERT', 'PASSWORD_RESET_CODE', 'PASSWORD_RESET_CONFIRMATION', 'PASSWORD_CHANGED', 'PROFILE_UPDATED')),
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DELIVERED' CHECK (status IN ('DELIVERED', 'SENT', 'FAILED', 'PENDING')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- -----------------------------------------------------------------------------
-- 11. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_status_dates ON public.projects(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_projects_directorate ON public.projects(directorate_id);
CREATE INDEX IF NOT EXISTS idx_projects_research_area ON public.projects(research_area_id);
CREATE INDEX IF NOT EXISTS idx_projects_pi ON public.projects(principal_investigator_id);
CREATE INDEX IF NOT EXISTS idx_users_directorate ON public.users(directorate_id);
CREATE INDEX IF NOT EXISTS idx_users_research_area ON public.users(research_area_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role_id);
CREATE INDEX IF NOT EXISTS idx_reports_status_due ON public.reports(status, due_date, is_overdue);
CREATE INDEX IF NOT EXISTS idx_reports_project ON public.reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_scientist ON public.reports(scientist_id);
CREATE INDEX IF NOT EXISTS idx_funding_project_status ON public.funding(project_id, status, award_date);
CREATE INDEX IF NOT EXISTS idx_funding_funder ON public.funding(funder_id);
CREATE INDEX IF NOT EXISTS idx_locations_geo ON public.locations(latitude, longitude, county, marine_coastal_area);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC, action, entity_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_email_dispatches_recipient ON public.email_dispatches(recipient_email, sent_at DESC);

-- -----------------------------------------------------------------------------
-- 12. ROW-LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_dispatches ENABLE ROW LEVEL SECURITY;

-- Permissive authenticated & service access policies for institutional system operations
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "service_all_access" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "service_all_access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
