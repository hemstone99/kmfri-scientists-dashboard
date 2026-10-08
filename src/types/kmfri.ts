import { z } from 'zod';

export enum RoleCode {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  DIRECTOR = 'DIRECTOR',
  HEAD_OCS = 'HEAD_OCS',
  SCIENTIST = 'SCIENTIST',
  VIEWER = 'VIEWER',
}

export enum PermissionCode {
  USERS_MANAGE = 'users:manage',
  USERS_VIEW = 'users:view',
  USERS_RESET_PASSWORD = 'users:reset_password',
  ROLES_MANAGE = 'roles:manage',
  PROJECTS_CREATE = 'projects:create',
  PROJECTS_EDIT = 'projects:edit',
  PROJECTS_APPROVE = 'projects:approve',
  PROJECTS_ARCHIVE = 'projects:archive',
  FUNDING_MANAGE = 'funding:manage',
  REPORTS_SUBMIT = 'reports:submit',
  REPORTS_REVIEW = 'reports:review',
  REPORTS_VIEW = 'reports:view',
  LOCATIONS_MANAGE = 'locations:manage',
  COLLABORATORS_MANAGE = 'collaborators:manage',
  OUTPUTS_MANAGE = 'outputs:manage',
  DOCUMENTS_MANAGE = 'documents:manage',
  SETTINGS_MANAGE = 'settings:manage',
  AUDIT_VIEW = 'audit:view',
  EXPORT_DATA = 'export:data',
}

export enum ProjectStatus {
  PROPOSED = 'Proposed',
  APPROVED = 'Approved',
  IN_PROGRESS = 'In Progress',
  SUSPENDED = 'Suspended',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export enum ProjectPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

export enum ReportStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted',
  UNDER_REVIEW = 'Under Review',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum OutputType {
  PUBLICATION = 'Publication',
  TECHNICAL_REPORT = 'Technical Report',
  DATASET = 'Dataset',
  PRESENTATION = 'Presentation',
}

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  code: PermissionCode;
  module: string;
  description: string;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface Directorate {
  id: string;
  code: string;
  name: string;
  headquarters: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResearchArea {
  id: string;
  code: string;
  name: string;
  directorate_id: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  staff_number: string;
  email: string;
  full_name: string;
  title: string;
  position: string;
  role_id: string;
  role_code: RoleCode;
  directorate_id: string | null;
  research_area_id: string | null;
  phone: string;
  office_station: string;
  orcid_id?: string;
  specialization?: string;
  bio?: string;
  avatar_url?: string;
  is_active: boolean;
  is_operational_scientist: boolean;
  last_login_at: string | null;
  password_reset_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface Funder {
  id: string;
  name: string;
  funder_type: 'Government' | 'Bilateral' | 'Multilateral' | 'Foundation' | 'Private' | 'Internal';
  country: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  title: string;
  description: string;
  objectives: string[];
  research_area_id: string;
  directorate_id: string;
  principal_investigator_id: string;
  start_date: string;
  end_date: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  budget: number;
  currency: 'KES' | 'USD' | 'EUR' | 'GBP';
  primary_funder_id: string | null;
  deliverables: string[];
  progress_percent: number;
  risks_issues: string;
  is_archived: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  project_role: 'Principal Investigator' | 'Co-Investigator' | 'Research Associate' | 'Field Technologist' | 'Data Analyst';
  allocation_percent: number;
  assigned_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string;
  due_date: string;
  completed_date: string | null;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Delayed';
  progress_percent: number;
  owner_id: string | null;
  deliverable_summary: string;
  created_at: string;
  updated_at: string;
}

export interface FundingGrant {
  id: string;
  grant_number: string;
  funder_id: string;
  project_id: string;
  amount: number;
  currency: 'KES' | 'USD' | 'EUR' | 'GBP';
  award_date: string;
  start_date: string;
  end_date: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  status: 'Pending' | 'Active' | 'Closed' | 'Suspended';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface GisLocation {
  id: string;
  country: string;
  county: string;
  sub_county: string;
  site_name: string;
  latitude: number;
  longitude: number;
  marine_coastal_area: 'Inshore Reef' | 'Mangrove Creek' | 'EEZ Offshore' | 'Estuary' | 'Seagrass Meadow' | 'Freshwater Lake' | 'Riverine Basin' | 'Aquaculture Station';
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectLocation {
  id: string;
  project_id: string;
  location_id: string;
  activity_summary: string;
  created_at: string;
}

export interface Collaborator {
  id: string;
  organization_name: string;
  contact_person: string;
  email: string;
  phone: string;
  country: string;
  organization_type: 'University' | 'Research Institute' | 'Government Agency' | 'NGO' | 'International Body' | 'Private Sector';
  collaboration_type: 'Joint Research' | 'Funding Partner' | 'Capacity Building' | 'Data Exchange' | 'Equipment Sharing' | 'Policy Advisory';
  agreement_start_date: string;
  agreement_end_date: string;
  mou_status: 'Draft' | 'Active' | 'Expired' | 'Renewal Pending';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCollaborator {
  id: string;
  project_id: string;
  collaborator_id: string;
  role_description: string;
  created_at: string;
}

export interface Report {
  id: string;
  title: string;
  project_id: string;
  scientist_id: string;
  report_type: 'Quarterly Progress' | 'Annual Technical' | 'Financial Audit' | 'Field Expedition' | 'Final Completion';
  reporting_period: string;
  due_date: string;
  submission_date: string | null;
  status: ReportStatus;
  is_overdue: boolean;
  reviewer_id: string | null;
  reviewer_comments: string;
  approval_date: string | null;
  version: number;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface ResearchOutput {
  id: string;
  title: string;
  output_type: OutputType;
  project_id: string | null;
  lead_scientist_id: string;
  journal_or_event: string;
  doi_or_url: string;
  publication_date: string;
  abstract: string;
  manuscript_body?: string;
  figure_urls?: string[];
  keywords: string[];
  status: 'Draft' | 'Under Peer Review' | 'Published' | 'Archived';
  created_at: string;
  updated_at: string;
}

export interface OutputAuthor {
  id: string;
  output_id: string;
  user_id: string | null;
  external_author_name: string;
  affiliation: string;
  author_order: number;
  is_corresponding: boolean;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  data_url?: string;
  category: 'Project Document' | 'Report Attachment' | 'Research Output' | 'Funding Agreement' | 'MOU Agreement' | 'Shared Image' | 'Dataset File';
  folder_id?: string | null;
  project_id: string | null;
  report_id: string | null;
  output_id: string | null;
  funding_id: string | null;
  collaborator_id: string | null;
  version: number;
  uploaded_by: string;
  checked_out_by?: string | null;
  checked_out_by_name?: string | null;
  checked_out_at?: string | null;
  word_content?: string;
  version_history?: Array<{
    version: number;
    updated_at: string;
    updated_by_name: string;
    summary: string;
  }>;
  co_author_ids?: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ResearchActivity {
  id: string;
  project_id: string;
  scientist_id: string;
  location_id: string | null;
  activity_type: 'Field Sampling' | 'Cruise Expedition' | 'Lab Analysis' | 'Stakeholder Workshop' | 'Data Modeling' | 'Milestone Review';
  title: string;
  description: string;
  activity_date: string;
  status: 'Planned' | 'Ongoing' | 'Completed' | 'Cancelled';
  observations: Record<string, unknown>;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  recipient_user_id: string | null;
  category: 'Account' | 'Assignment' | 'Project Approval' | 'Report Deadline' | 'Report Submission' | 'Report Review' | 'Milestone' | 'Funding' | 'Announcement';
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  category: string;
  description: string;
  updated_by: string | null;
  updated_at: string;
}

export interface SharedFolder {
  id: string;
  name: string;
  description: string;
  directorate_id: string | null;
  project_id: string | null;
  created_by: string;
  created_by_name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ChatAttachment {
  id: string;
  type: 'image' | 'file' | 'folder' | 'publication';
  title: string;
  file_name?: string;
  mime_type?: string;
  data_url?: string;
  reference_id?: string;
  size_bytes?: number;
}

export interface ChatMessage {
  id: string;
  channel_id: string; // e.g. 'general-research', 'oceans-coastal', or 'dm:<uid1>:<uid2>'
  sender_id: string;
  sender_name: string;
  sender_title: string;
  sender_role: RoleCode;
  sender_avatar?: string;
  sender_station?: string;
  content: string;
  attachments: ChatAttachment[];
  created_at: string;
}

export interface EmailDispatch {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  type: 'LOGIN_ALERT' | 'PASSWORD_RESET_CODE' | 'PASSWORD_RESET_CONFIRMATION' | 'PASSWORD_CHANGED' | 'PROFILE_UPDATED';
  body_html: string;
  body_text: string;
  status: 'DELIVERED' | 'SENT' | 'FAILED' | 'PENDING';
  sent_at: string;
  metadata?: Record<string, any>;
}

export interface DatabaseSnapshot {
  roles: Role[];
  permissions: Permission[];
  role_permissions: RolePermission[];
  directorates: Directorate[];
  research_areas: ResearchArea[];
  users: UserProfile[];
  funders: Funder[];
  projects: Project[];
  project_members: ProjectMember[];
  project_milestones: ProjectMilestone[];
  funding: FundingGrant[];
  locations: GisLocation[];
  project_locations: ProjectLocation[];
  collaborators: Collaborator[];
  project_collaborators: ProjectCollaborator[];
  reports: Report[];
  research_outputs: ResearchOutput[];
  output_authors: OutputAuthor[];
  documents: DocumentRecord[];
  shared_folders: SharedFolder[];
  chat_messages: ChatMessage[];
  research_activities: ResearchActivity[];
  notifications: NotificationItem[];
  audit_logs: AuditLog[];
  system_settings: SystemSetting[];
  email_dispatches?: EmailDispatch[];
}

export type NavigationModule =
  | 'dashboard'
  | 'scientists'
  | 'projects'
  | 'funding'
  | 'reports'
  | 'locations'
  | 'collaborators'
  | 'outputs'
  | 'documents'
  | 'chat'
  | 'ai_assistant'
  | 'balanced_scorecard'
  | 'notifications'
  | 'administration'
  | 'profile';

// =============================================================================
// ZOD VALIDATION SCHEMAS
// =============================================================================

export const loginSchema = z.object({
  email: z.string().email('Enter a valid KMFRI institutional email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const scientistFormSchema = z.object({
  staff_number: z.string().min(3, 'Staff number is required (e.g., KMFRI/RES/1042)'),
  email: z.string().email('Valid institutional email is required'),
  full_name: z.string().min(3, 'Full name is required'),
  title: z.string().min(1, 'Title is required'),
  position: z.string().min(2, 'Position/Rank is required'),
  role_code: z.nativeEnum(RoleCode),
  directorate_id: z.string().min(1, 'Directorate is required'),
  research_area_id: z.string().min(1, 'Research area is required'),
  phone: z.string().min(6, 'Contact phone is required'),
  office_station: z.string().min(2, 'Office/Station is required'),
  orcid_id: z.string().optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  password: z.string().min(6, 'Initial password must be at least 6 characters').optional(),
});

export const projectFormSchema = z.object({
  project_code: z.string().min(3, 'Project code is required (e.g., KMFRI-OCS-2026-01)'),
  title: z.string().min(5, 'Project title must be at least 5 characters'),
  description: z.string().min(10, 'Description is required'),
  objectives_text: z.string().min(5, 'Enter at least one project objective'),
  research_area_id: z.string().min(1, 'Research area is required'),
  directorate_id: z.string().min(1, 'Directorate is required'),
  principal_investigator_id: z.string().min(1, 'Principal Investigator is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  status: z.nativeEnum(ProjectStatus),
  priority: z.nativeEnum(ProjectPriority),
  budget: z.coerce.number().min(0, 'Budget must be zero or positive'),
  currency: z.enum(['KES', 'USD', 'EUR', 'GBP']),
  primary_funder_id: z.string().optional(),
  deliverables_text: z.string().optional(),
  progress_percent: z.coerce.number().min(0).max(100),
  risks_issues: z.string().optional(),
});

export const fundingGrantSchema = z.object({
  grant_number: z.string().min(3, 'Grant number is required (e.g., WIOMSA-MASMA-2026-04)'),
  funder_id: z.string().min(1, 'Funder is required'),
  project_id: z.string().min(1, 'Linked project is required'),
  amount: z.coerce.number().positive('Grant amount must be greater than 0'),
  currency: z.enum(['KES', 'USD', 'EUR', 'GBP']),
  award_date: z.string().min(1, 'Award date is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  allocated_amount: z.coerce.number().min(0),
  spent_amount: z.coerce.number().min(0),
  status: z.enum(['Pending', 'Active', 'Closed', 'Suspended']),
  notes: z.string().optional(),
});

export const reportFormSchema = z.object({
  title: z.string().min(4, 'Report title is required'),
  project_id: z.string().min(1, 'Project is required'),
  scientist_id: z.string().min(1, 'Lead scientist is required'),
  report_type: z.enum(['Quarterly Progress', 'Annual Technical', 'Financial Audit', 'Field Expedition', 'Final Completion']),
  reporting_period: z.string().min(2, 'Reporting period is required (e.g., Q1 FY 2026/27)'),
  due_date: z.string().min(1, 'Due date is required'),
  status: z.nativeEnum(ReportStatus),
  summary: z.string().min(10, 'Executive summary is required'),
});

export const locationFormSchema = z.object({
  country: z.string().min(2, 'Country is required'),
  county: z.string().min(2, 'County is required'),
  sub_county: z.string().min(2, 'Sub-county is required'),
  site_name: z.string().min(2, 'Site/station name is required'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  marine_coastal_area: z.enum(['Inshore Reef', 'Mangrove Creek', 'EEZ Offshore', 'Estuary', 'Seagrass Meadow', 'Freshwater Lake', 'Riverine Basin', 'Aquaculture Station']),
  description: z.string().optional(),
  project_id: z.string().optional(),
  activity_summary: z.string().optional(),
});

export const collaboratorFormSchema = z.object({
  organization_name: z.string().min(2, 'Organization name is required'),
  contact_person: z.string().min(2, 'Contact person is required'),
  email: z.string().email('Valid contact email is required'),
  phone: z.string().min(5, 'Contact phone is required'),
  country: z.string().min(2, 'Country is required'),
  organization_type: z.enum(['University', 'Research Institute', 'Government Agency', 'NGO', 'International Body', 'Private Sector']),
  collaboration_type: z.enum(['Joint Research', 'Funding Partner', 'Capacity Building', 'Data Exchange', 'Equipment Sharing', 'Policy Advisory']),
  agreement_start_date: z.string().min(1, 'Agreement start date is required'),
  agreement_end_date: z.string().min(1, 'Agreement end date is required'),
  mou_status: z.enum(['Draft', 'Active', 'Expired', 'Renewal Pending']),
  project_id: z.string().optional(),
  notes: z.string().optional(),
});

export const outputFormSchema = z.object({
  title: z.string().min(5, 'Output title is required'),
  output_type: z.nativeEnum(OutputType),
  project_id: z.string().optional(),
  lead_scientist_id: z.string().min(1, 'Lead scientist is required'),
  journal_or_event: z.string().min(2, 'Journal, publisher, repository, or conference is required'),
  doi_or_url: z.string().optional(),
  publication_date: z.string().min(1, 'Publication date is required'),
  abstract: z.string().min(10, 'Abstract/description is required'),
  keywords_text: z.string().optional(),
  status: z.enum(['Draft', 'Under Peer Review', 'Published', 'Archived']),
});

// =============================================================================
// BALANCED SCORECARD (BSC) EVALUATION TYPES
// =============================================================================

export interface BscPerspectiveScore {
  score: number;
  max: number;
  percent: number;
  details: string[];
}

export interface ScientistBscScore {
  scientist_id: string;
  scientist_name: string;
  staff_number: string;
  title: string;
  position: string;
  directorate_name: string;
  avatar_url?: string;
  total_score: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  grade_label: string;
  rank: number;
  perspectives: {
    scientific_excellence: BscPerspectiveScore;
    policy_stakeholder_impact: BscPerspectiveScore;
    grant_stewardship: BscPerspectiveScore;
    capacity_collaboration: BscPerspectiveScore;
  };
  metrics: {
    projects_led: number;
    projects_participated: number;
    milestones_completed: number;
    milestones_pending: number;
    reports_approved: number;
    reports_pending: number;
    publications_count: number;
    datasets_count: number;
    activities_count: number;
    funding_secured: number;
    collaborators_linked: number;
  };
}
