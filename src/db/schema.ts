import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  doublePrecision,
  jsonb,
  primaryKey,
  index,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Roles
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Permissions
export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
});

// 3. Role Permissions (Composite PK)
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
  ]
);

// 4. Directorates
export const directorates = pgTable(
  'directorates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull().unique(),
    description: text('description'),
    headUserId: uuid('head_user_id').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_directorates_code').on(table.code),
    index('idx_directorates_head').on(table.headUserId),
  ]
);

// 5. Research Areas
export const researchAreas = pgTable(
  'research_areas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    directorateId: uuid('directorate_id')
      .notNull()
      .references(() => directorates.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_research_areas_directorate').on(table.directorateId),
  ]
);

// 6. Users (Scientists, Admins, Directors, Viewers)
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uid: text('uid').notNull().unique(), // Firebase Auth UID
    authId: text('auth_id'), // Managed auth identifier
    fullName: text('full_name').notNull(),
    email: text('email').notNull().unique(),
    phone: text('phone'),
    staffNumber: text('staff_number').unique(),
    profilePhoto: text('profile_photo'),
    position: text('position'),
    directorateId: uuid('directorate_id').references(
      (): AnyPgColumn => directorates.id,
      { onDelete: 'set null' }
    ),
    researchAreaId: uuid('research_area_id').references(
      () => researchAreas.id,
      { onDelete: 'set null' }
    ),
    roleId: uuid('role_id').references(() => roles.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('Active'), // Active, Inactive, Suspended, PasswordResetRequired
    lastLogin: timestamp('last_login'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_directorate').on(table.directorateId),
    index('idx_users_research_area').on(table.researchAreaId),
    index('idx_users_role').on(table.roleId),
    index('idx_users_status').on(table.status),
    index('idx_users_email').on(table.email),
  ]
);

// 7. Projects
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectCode: text('project_code').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    objectives: text('objectives'),
    deliverables: text('deliverables'),
    risksIssues: text('risks_issues'),
    researchAreaId: uuid('research_area_id').references(
      () => researchAreas.id,
      { onDelete: 'set null' }
    ),
    directorateId: uuid('directorate_id').references(() => directorates.id, {
      onDelete: 'set null',
    }),
    principalInvestigatorId: uuid('principal_investigator_id').references(
      () => users.id,
      { onDelete: 'set null' }
    ),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    status: text('status').notNull().default('Proposed'), // Proposed, Approved, In Progress, Suspended, Completed, Cancelled, Archived
    priority: text('priority').notNull().default('Medium'), // Low, Medium, High, Critical
    budget: numeric('budget', { precision: 15, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('KES'),
    progressPercent: integer('progress_percent').notNull().default(0),
    locationSummary: text('location_summary'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_projects_status').on(table.status),
    index('idx_projects_dates').on(table.startDate, table.endDate),
    index('idx_projects_directorate').on(table.directorateId),
    index('idx_projects_research_area').on(table.researchAreaId),
    index('idx_projects_pi').on(table.principalInvestigatorId),
  ]
);

// 8. Project Members
export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('Co-Investigator'), // Principal Investigator, Co-Investigator, Research Scientist, Field Technologist, Data Analyst
    startDate: text('start_date'),
    endDate: text('end_date'),
  },
  (table) => [
    index('idx_project_members_project').on(table.projectId),
    index('idx_project_members_user').on(table.userId),
  ]
);

// 9. Project Milestones
export const projectMilestones = pgTable(
  'project_milestones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: text('due_date').notNull(),
    completionDate: text('completion_date'),
    status: text('status').notNull().default('Pending'), // Pending, In Progress, Completed, Delayed
    progressPercent: integer('progress_percent').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_project_milestones_project').on(table.projectId),
    index('idx_project_milestones_status').on(table.status),
  ]
);

// 10. Funders
export const funders = pgTable(
  'funders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(), // Government, Multilateral, Bilateral, Foundation, International NGO, Private Sector
    country: text('country').notNull().default('Kenya'),
    contactPerson: text('contact_person'),
    email: text('email'),
    phone: text('phone'),
    website: text('website'),
  },
  (table) => [
    index('idx_funders_type').on(table.type),
    index('idx_funders_country').on(table.country),
  ]
);

// 11. Funding / Grants
export const funding = pgTable(
  'funding',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    funderId: uuid('funder_id')
      .notNull()
      .references(() => funders.id, { onDelete: 'restrict' }),
    grantNumber: text('grant_number').notNull().unique(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('USD'),
    awardDate: text('award_date').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    allocatedAmount: numeric('allocated_amount', { precision: 15, scale: 2 })
      .notNull()
      .default('0'),
    spentAmount: numeric('spent_amount', { precision: 15, scale: 2 })
      .notNull()
      .default('0'),
    status: text('status').notNull().default('Active'), // Active, Disbursing, Completed, Pending, Closed
    documentUrl: text('document_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_funding_project').on(table.projectId),
    index('idx_funding_funder').on(table.funderId),
    index('idx_funding_status').on(table.status),
    index('idx_funding_dates').on(table.awardDate, table.startDate, table.endDate),
  ]
);

// 12. Locations (GIS Marine & Freshwater Stations / Sites)
export const locations = pgTable(
  'locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    country: text('country').notNull().default('Kenya'),
    county: text('county').notNull(),
    subCounty: text('sub_county'),
    site: text('site').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    marineArea: text('marine_area').notNull(), // e.g., Exclusive Economic Zone (EEZ), Tudor Creek, Kisumu Bay (Lake Victoria), Malindi-Watamu Marine Reserve
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_locations_coords').on(table.latitude, table.longitude),
    index('idx_locations_county').on(table.county),
    index('idx_locations_marine_area').on(table.marineArea),
  ]
);

// 13. Project Locations (Composite PK)
export const projectLocations = pgTable(
  'project_locations',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    activityDescription: text('activity_description'),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.locationId] }),
    index('idx_project_locations_project').on(table.projectId),
    index('idx_project_locations_location').on(table.locationId),
  ]
);

// 14. Collaborators
export const collaborators = pgTable(
  'collaborators',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationName: text('organization_name').notNull(),
    contactPerson: text('contact_person'),
    email: text('email'),
    phone: text('phone'),
    country: text('country').notNull().default('Kenya'),
    organizationType: text('organization_type').notNull(), // University, Research Institute, Government Agency, International Body, NGO, Community (BMU)
    collaborationType: text('collaboration_type').notNull(), // Joint Research, Technical Exchange, Funding & Capacity Building, Data Sharing, Equipment Access
    startDate: text('start_date'),
    endDate: text('end_date'),
    mouDocumentUrl: text('mou_document_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_collaborators_org_type').on(table.organizationType),
    index('idx_collaborators_country').on(table.country),
  ]
);

// 15. Project Collaborators (Composite PK)
export const projectCollaborators = pgTable(
  'project_collaborators',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    collaboratorId: uuid('collaborator_id')
      .notNull()
      .references(() => collaborators.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('Research Partner'),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.collaboratorId] }),
  ]
);

// 16. Reports
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    scientistId: uuid('scientist_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    reportType: text('report_type').notNull(), // Quarterly Progress, Annual Technical, Field Cruise Report, Financial Utilization, Final Completion
    reportingPeriod: text('reporting_period').notNull(), // e.g., Q1 2026, FY 2025/2026
    submissionDate: text('submission_date'),
    dueDate: text('due_date').notNull(),
    status: text('status').notNull().default('Draft'), // Draft, Submitted, Under Review, Approved, Rejected
    reviewerId: uuid('reviewer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewComments: text('review_comments'),
    approvalDate: text('approval_date'),
    fileUrl: text('file_url'),
    version: text('version').notNull().default('1.0'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_reports_status').on(table.status),
    index('idx_reports_due_date').on(table.dueDate),
    index('idx_reports_project').on(table.projectId),
    index('idx_reports_scientist').on(table.scientistId),
  ]
);

// 17. Research Outputs
export const researchOutputs = pgTable(
  'research_outputs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    outputType: text('output_type').notNull(), // Peer-Reviewed Publication, Technical Report, Oceanographic Dataset, Conference Presentation, Policy Brief
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    leadScientistId: uuid('lead_scientist_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    journalOrEvent: text('journal_or_event'),
    doi: text('doi'),
    url: text('url'),
    publicationDate: text('publication_date').notNull(),
    abstract: text('abstract'),
    manuscriptBody: text('manuscript_body'),
    keywords: text('keywords'),
    fileUrl: text('file_url'),
    status: text('status').notNull().default('Published'), // Draft, In Press, Published, Archived
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_outputs_type').on(table.outputType),
    index('idx_outputs_project').on(table.projectId),
    index('idx_outputs_lead_scientist').on(table.leadScientistId),
  ]
);

// 18. Output Authors (Composite PK)
export const outputAuthors = pgTable(
  'output_authors',
  {
    outputId: uuid('output_id')
      .notNull()
      .references(() => researchOutputs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    authorOrder: integer('author_order').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.outputId, table.userId] }),
  ]
);

// 19. Documents & Shared Files/Images (with SharePoint & Word Co-Authoring)
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'cascade',
    }),
    folderId: uuid('folder_id'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    type: text('type').notNull(), // Word Document, SharePoint Page, Excel Sheet, Proposal, Ethics Approval, Cruise Plan, Dataset Archive, MOU, Technical Annex, Image, Shared File
    mimeType: text('mime_type').default('application/octet-stream'),
    description: text('description'),
    contentBody: text('content_body'),
    sharepointStatus: text('sharepoint_status').notNull().default('Published'), // Draft, Checked Out, In Review, Approved, Published
    checkedOutBy: uuid('checked_out_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    lastEditedBy: uuid('last_edited_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    fileUrl: text('file_url').notNull(),
    fileSize: text('file_size').notNull().default('0 KB'),
    version: text('version').notNull().default('1.0'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_documents_project').on(table.projectId),
    index('idx_documents_folder').on(table.folderId),
    index('idx_documents_uploaded_by').on(table.uploadedBy),
  ]
);

// 20. Research Activities & Balanced Scorecard Events
export const researchActivities = pgTable(
  'research_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'cascade',
    }),
    scientistId: uuid('scientist_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    eventType: text('event_type').notNull().default('Field Expedition'),
    description: text('description'),
    activityDate: text('activity_date').notNull(),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('Completed'), // Planned, In Progress, Completed, Cancelled
    hours: numeric('hours', { precision: 6, scale: 2 }).notNull().default('0'),
    scoreWeight: integer('score_weight').notNull().default(10),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_activities_project').on(table.projectId),
    index('idx_activities_scientist').on(table.scientistId),
    index('idx_activities_date').on(table.activityDate),
  ]
);

// 21. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull().default('Info'), // Assignment, Approval, Deadline, Submission, Review, Milestone, Funding, Announcement, Account
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_notifications_user').on(table.userId),
  ]
);

// 22. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(), // CREATE, UPDATE, DELETE, APPROVE, REJECT, SUBMIT, LOGIN, EXPORT, ARCHIVE
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_logs_user').on(table.userId),
    index('idx_audit_logs_entity').on(table.entityType),
    index('idx_audit_logs_created').on(table.createdAt),
  ]
);

// 23. System Settings
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: jsonb('setting_value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 24. Shared Folders (Platform-Wide File, Folder & Image Sharing)
export const sharedFolders = pgTable(
  'shared_folders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('Research Workspace'),
    parentFolderId: uuid('parent_folder_id'),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_shared_folders_project').on(table.projectId),
    index('idx_shared_folders_creator').on(table.createdBy),
  ]
);

// 25. Real-Time Scientist Chat & Research Collaboration Messages
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channelId: text('channel_id').notNull().default('general-research'),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    content: text('content').notNull(),
    attachmentUrl: text('attachment_url'),
    attachmentName: text('attachment_name'),
    attachmentType: text('attachment_type'), // 'image' | 'file' | 'publication' | 'project'
    linkedOutputId: uuid('linked_output_id').references(
      () => researchOutputs.id,
      { onDelete: 'set null' }
    ),
    linkedProjectId: uuid('linked_project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_chat_messages_channel').on(table.channelId),
    index('idx_chat_messages_sender').on(table.senderId),
    index('idx_chat_messages_created').on(table.createdAt),
  ]
);

// Drizzle Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const directoratesRelations = relations(directorates, ({ one, many }) => ({
  headUser: one(users, {
    fields: [directorates.headUserId],
    references: [users.id],
  }),
  researchAreas: many(researchAreas),
  projects: many(projects),
}));

export const researchAreasRelations = relations(researchAreas, ({ one, many }) => ({
  directorate: one(directorates, {
    fields: [researchAreas.directorateId],
    references: [directorates.id],
  }),
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  directorate: one(directorates, {
    fields: [users.directorateId],
    references: [directorates.id],
  }),
  researchArea: one(researchAreas, {
    fields: [users.researchAreaId],
    references: [researchAreas.id],
  }),
  ledProjects: many(projects),
  reports: many(reports),
  activities: many(researchActivities),
  notifications: many(notifications),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  directorate: one(directorates, {
    fields: [projects.directorateId],
    references: [directorates.id],
  }),
  researchArea: one(researchAreas, {
    fields: [projects.researchAreaId],
    references: [researchAreas.id],
  }),
  principalInvestigator: one(users, {
    fields: [projects.principalInvestigatorId],
    references: [users.id],
  }),
  members: many(projectMembers),
  milestones: many(projectMilestones),
  fundingRecords: many(funding),
  projectLocations: many(projectLocations),
  projectCollaborators: many(projectCollaborators),
  reports: many(reports),
  outputs: many(researchOutputs),
  documents: many(documents),
  activities: many(researchActivities),
}));
