import { RoleName } from './lib/domain.ts';

export interface RoleRecord {
  id: string;
  name: RoleName;
  description: string | null;
  createdAt: string;
}

export interface PermissionRecord {
  id: string;
  name: string;
  description: string | null;
}

export interface RolePermissionRecord {
  roleId: string;
  permissionId: string;
}

export interface DirectorateRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  headUserId: string | null;
  createdAt: string;
}

export interface ResearchAreaRecord {
  id: string;
  name: string;
  description: string | null;
  directorateId: string;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  uid: string;
  authId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  staffNumber: string | null;
  profilePhoto: string | null;
  position: string | null;
  directorateId: string | null;
  researchAreaId: string | null;
  roleId: string | null;
  status: string;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  // Extended fields on currentUser
  roleName?: RoleName;
  permissions?: string[];
  directorateName?: string;
  directorateCode?: string | null;
  researchAreaName?: string;
}

export interface ProjectRecord {
  id: string;
  projectCode: string;
  title: string;
  description: string | null;
  objectives: string | null;
  deliverables: string | null;
  risksIssues: string | null;
  researchAreaId: string | null;
  directorateId: string | null;
  principalInvestigatorId: string | null;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  budget: string;
  currency: string;
  progressPercent: number;
  locationSummary: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ProjectMilestoneRecord {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: string;
  completionDate: string | null;
  status: string;
  progressPercent: number;
  createdAt: string;
}

export interface FunderRecord {
  id: string;
  name: string;
  type: string;
  country: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}

export interface FundingRecord {
  id: string;
  projectId: string;
  funderId: string;
  grantNumber: string;
  amount: string;
  currency: string;
  awardDate: string;
  startDate: string;
  endDate: string;
  allocatedAmount: string;
  spentAmount: string;
  status: string;
  documentUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocationRecord {
  id: string;
  name: string;
  country: string;
  county: string;
  subCounty: string | null;
  site: string;
  latitude: number;
  longitude: number;
  marineArea: string;
  description: string | null;
  createdAt: string;
}

export interface ProjectLocationRecord {
  projectId: string;
  locationId: string;
  activityDescription: string | null;
}

export interface CollaboratorRecord {
  id: string;
  organizationName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  organizationType: string;
  collaborationType: string;
  startDate: string | null;
  endDate: string | null;
  mouDocumentUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ProjectCollaboratorRecord {
  projectId: string;
  collaboratorId: string;
  role: string;
}

export interface ReportRecord {
  id: string;
  projectId: string;
  scientistId: string;
  title: string;
  reportType: string;
  reportingPeriod: string;
  submissionDate: string | null;
  dueDate: string;
  status: string;
  reviewerId: string | null;
  reviewComments: string | null;
  approvalDate: string | null;
  fileUrl: string | null;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchOutputRecord {
  id: string;
  title: string;
  outputType: string;
  projectId: string | null;
  leadScientistId: string | null;
  journalOrEvent: string | null;
  doi: string | null;
  url: string | null;
  publicationDate: string;
  abstract: string | null;
  manuscriptBody?: string | null;
  keywords: string | null;
  fileUrl: string | null;
  status: string;
  createdAt: string;
}

export interface OutputAuthorRecord {
  outputId: string;
  userId: string;
  authorOrder: number;
}

export interface DocumentRecord {
  id: string;
  projectId: string | null;
  folderId?: string | null;
  uploadedBy: string | null;
  name: string;
  type: string;
  mimeType?: string | null;
  description?: string | null;
  contentBody?: string | null;
  sharepointStatus?: string;
  checkedOutBy?: string | null;
  lastEditedBy?: string | null;
  fileUrl: string;
  fileSize: string;
  version: string;
  updatedAt?: string;
  createdAt: string;
}

export interface SharedFolderRecord {
  id: string;
  name: string;
  description: string | null;
  category: string;
  parentFolderId: string | null;
  projectId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ChatMessageRecord {
  id: string;
  channelId: string;
  senderId: string;
  recipientId: string | null;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  linkedOutputId: string | null;
  linkedProjectId: string | null;
  createdAt: string;
}

export interface OnlineScientistPresence {
  userId: string;
  fullName: string;
  staffNumber: string | null;
  roleName: string;
  directorateCode: string | null;
  profilePhoto?: string | null;
  connectedAt: string;
}

export interface ResearchActivityRecord {
  id: string;
  projectId: string | null;
  scientistId: string;
  title: string;
  eventType?: string;
  description: string | null;
  activityDate: string;
  locationId: string | null;
  status: string;
  hours: string;
  scoreWeight?: number;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: any;
  newValues: any;
  ipAddress: string | null;
  createdAt: string;
}

export interface SystemSettingRecord {
  id: string;
  settingKey: string;
  settingValue: any;
  updatedAt: string;
}

export interface BootstrapData {
  currentUser: UserRecord;
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  rolePermissions: RolePermissionRecord[];
  directorates: DirectorateRecord[];
  researchAreas: ResearchAreaRecord[];
  users: UserRecord[];
  projects: ProjectRecord[];
  projectMembers: ProjectMemberRecord[];
  projectMilestones: ProjectMilestoneRecord[];
  funders: FunderRecord[];
  funding: FundingRecord[];
  locations: LocationRecord[];
  projectLocations: ProjectLocationRecord[];
  collaborators: CollaboratorRecord[];
  projectCollaborators: ProjectCollaboratorRecord[];
  reports: ReportRecord[];
  researchOutputs: ResearchOutputRecord[];
  outputAuthors: OutputAuthorRecord[];
  documents: DocumentRecord[];
  sharedFolders: SharedFolderRecord[];
  chatMessages: ChatMessageRecord[];
  researchActivities: ResearchActivityRecord[];
  notifications: NotificationRecord[];
  auditLogs: AuditLogRecord[];
  systemSettings: SystemSettingRecord[];
}
