import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { scheduleSupabaseMirror } from './supabase.ts';
import {
  DatabaseSnapshot,
  RoleCode,
  PermissionCode,
  ReportStatus,
  UserProfile,
  AuditLog,
  NotificationItem,
  EmailDispatch,
} from '../types/kmfri.ts';

// Render and other PaaS providers mount a persistent volume; point KMFRI_DATA_DIR at it
// so institutional records survive deploys (the default ./data directory is ephemeral).
const DATA_DIR = process.env.KMFRI_DATA_DIR
  ? path.resolve(process.env.KMFRI_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'kmfri_db.json');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'kmfri_auth.json');

export interface AuthCredentialRecord {
  user_id: string;
  email: string;
  password_hash: string;
  reset_token?: string | null;
  reset_expires_at?: string | null;
}

const SCRYPT_KEYLEN = 64;
const LEGACY_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** JSON.parse rejects a UTF-8 byte-order mark, which editors like to add. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Password hash: scrypt with a per-credential random salt. Format: scrypt$<salt>$<hash> */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function legacyPasswordHash(password: string): string {
  return crypto.createHash('sha256').update(`kmfri_salt_v1:${password}`).digest('hex');
}

/**
 * Verifies a password against a stored hash. Legacy salted-SHA256 hashes from earlier
 * installs still validate, and are reported as `needsRehash` so the caller can upgrade them.
 */
export function verifyPassword(
  password: string,
  storedHash: string
): { valid: boolean; needsRehash: boolean } {
  if (!storedHash) return { valid: false, needsRehash: false };

  if (storedHash.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = storedHash.split('$');
    if (!saltHex || !hashHex) return { valid: false, needsRehash: false };
    const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
    const expected = Buffer.from(hashHex, 'hex');
    if (expected.length !== derived.length) return { valid: false, needsRehash: false };
    const valid = crypto.timingSafeEqual(derived, expected);
    return { valid, needsRehash: !valid };
  }

  if (LEGACY_HASH_PATTERN.test(storedHash)) {
    const expected = Buffer.from(storedHash, 'hex');
    const actual = Buffer.from(legacyPasswordHash(password), 'hex');
    const valid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    // Legacy hashes used a source-visible salt, so they must be upgraded on success.
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
}

/**
 * Password used for bootstrap/system accounts that have no credential yet.
 * Set KMFRI_INITIAL_ADMIN_PASSWORD in the environment; otherwise a strong random
 * password is generated and printed once to the server log.
 */
export function resolveInitialAdminPassword(): string {
  const fromEnv = (process.env.KMFRI_INITIAL_ADMIN_PASSWORD || '').trim();
  if (fromEnv.length >= 12) return fromEnv;
  return generateStrongPassword();
}

export function generateStrongPassword(bytes = 18): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

const ROLE_IDS: Record<RoleCode, string> = {
  [RoleCode.SUPER_ADMIN]: '10000000-0000-4000-8000-000000000001',
  [RoleCode.ADMIN]: '10000000-0000-4000-8000-000000000002',
  [RoleCode.DIRECTOR]: '10000000-0000-4000-8000-000000000003',
  [RoleCode.HEAD_OCS]: '10000000-0000-4000-8000-000000000004',
  [RoleCode.SCIENTIST]: '10000000-0000-4000-8000-000000000005',
  [RoleCode.VIEWER]: '10000000-0000-4000-8000-000000000006',
};

const PERMISSION_DEFS: Array<{ id: string; code: PermissionCode; module: string; description: string }> = [
  { id: '20000000-0000-4000-8000-000000000001', code: PermissionCode.USERS_MANAGE, module: 'Administration', description: 'Create, edit, deactivate, and reactivate scientist and user accounts' },
  { id: '20000000-0000-4000-8000-000000000002', code: PermissionCode.USERS_RESET_PASSWORD, module: 'Administration', description: 'Reset user account passwords and clear lockouts' },
  { id: '20000000-0000-4000-8000-000000000003', code: PermissionCode.ROLES_MANAGE, module: 'Administration', description: 'Configure RBAC roles and permission assignments' },
  { id: '20000000-0000-4000-8000-000000000004', code: PermissionCode.PROJECTS_CREATE, module: 'Projects', description: 'Create new research project proposals' },
  { id: '20000000-0000-4000-8000-000000000005', code: PermissionCode.PROJECTS_EDIT, module: 'Projects', description: 'Update project details, team members, milestones, and progress' },
  { id: '20000000-0000-4000-8000-000000000006', code: PermissionCode.PROJECTS_APPROVE, module: 'Projects', description: 'Approve, suspend, complete, or cancel research projects' },
  { id: '20000000-0000-4000-8000-000000000007', code: PermissionCode.PROJECTS_ARCHIVE, module: 'Projects', description: 'Archive and restore research projects' },
  { id: '20000000-0000-4000-8000-000000000008', code: PermissionCode.FUNDING_MANAGE, module: 'Funding', description: 'Manage funders, grant awards, and financial allocations' },
  { id: '20000000-0000-4000-8000-000000000009', code: PermissionCode.REPORTS_SUBMIT, module: 'Reports', description: 'Draft and submit research and technical reports' },
  { id: '20000000-0000-4000-8000-000000000010', code: PermissionCode.REPORTS_REVIEW, module: 'Reports', description: 'Review, approve, or reject submitted scientist reports' },
  { id: '20000000-0000-4000-8000-000000000011', code: PermissionCode.LOCATIONS_MANAGE, module: 'Locations', description: 'Manage GIS marine, coastal, and freshwater sampling stations' },
  { id: '20000000-0000-4000-8000-000000000012', code: PermissionCode.COLLABORATORS_MANAGE, module: 'Collaborators', description: 'Manage partner organizations and MOU agreements' },
  { id: '20000000-0000-4000-8000-000000000013', code: PermissionCode.OUTPUTS_MANAGE, module: 'Research Outputs', description: 'Create and update publications, datasets, presentations, and technical reports' },
  { id: '20000000-0000-4000-8000-000000000014', code: PermissionCode.DOCUMENTS_MANAGE, module: 'Documents', description: 'Upload, version, and manage research attachments' },
  { id: '20000000-0000-4000-8000-000000000015', code: PermissionCode.SETTINGS_MANAGE, module: 'Administration', description: 'Modify institutional settings, directorates, and research areas' },
  { id: '20000000-0000-4000-8000-000000000016', code: PermissionCode.AUDIT_VIEW, module: 'Administration', description: 'Inspect immutable security and operational audit logs' },
  { id: '20000000-0000-4000-8000-000000000017', code: PermissionCode.EXPORT_DATA, module: 'System', description: 'Export institutional records to CSV, Excel, and PDF' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  [RoleCode.SUPER_ADMIN]: Object.values(PermissionCode),
  [RoleCode.ADMIN]: [
    PermissionCode.USERS_MANAGE,
    PermissionCode.USERS_RESET_PASSWORD,
    PermissionCode.PROJECTS_CREATE,
    PermissionCode.PROJECTS_EDIT,
    PermissionCode.PROJECTS_ARCHIVE,
    PermissionCode.FUNDING_MANAGE,
    PermissionCode.REPORTS_SUBMIT,
    PermissionCode.LOCATIONS_MANAGE,
    PermissionCode.COLLABORATORS_MANAGE,
    PermissionCode.OUTPUTS_MANAGE,
    PermissionCode.DOCUMENTS_MANAGE,
    PermissionCode.SETTINGS_MANAGE,
    PermissionCode.AUDIT_VIEW,
    PermissionCode.EXPORT_DATA,
  ],
  [RoleCode.DIRECTOR]: [
    PermissionCode.PROJECTS_CREATE,
    PermissionCode.PROJECTS_EDIT,
    PermissionCode.PROJECTS_APPROVE,
    PermissionCode.PROJECTS_ARCHIVE,
    PermissionCode.FUNDING_MANAGE,
    PermissionCode.REPORTS_REVIEW,
    PermissionCode.COLLABORATORS_MANAGE,
    PermissionCode.AUDIT_VIEW,
    PermissionCode.EXPORT_DATA,
  ],
  [RoleCode.HEAD_OCS]: [
    PermissionCode.PROJECTS_CREATE,
    PermissionCode.PROJECTS_EDIT,
    PermissionCode.PROJECTS_APPROVE,
    PermissionCode.FUNDING_MANAGE,
    PermissionCode.REPORTS_SUBMIT,
    PermissionCode.REPORTS_REVIEW,
    PermissionCode.LOCATIONS_MANAGE,
    PermissionCode.COLLABORATORS_MANAGE,
    PermissionCode.OUTPUTS_MANAGE,
    PermissionCode.DOCUMENTS_MANAGE,
    PermissionCode.EXPORT_DATA,
  ],
  [RoleCode.SCIENTIST]: [
    PermissionCode.PROJECTS_CREATE,
    PermissionCode.PROJECTS_EDIT,
    PermissionCode.REPORTS_SUBMIT,
    PermissionCode.LOCATIONS_MANAGE,
    PermissionCode.OUTPUTS_MANAGE,
    PermissionCode.DOCUMENTS_MANAGE,
    PermissionCode.EXPORT_DATA,
  ],
  [RoleCode.VIEWER]: [
    PermissionCode.EXPORT_DATA,
  ],
};

function createReferenceSeedDatabase(): DatabaseSnapshot {
  const now = new Date().toISOString();

  const roles = [
    { id: ROLE_IDS[RoleCode.SUPER_ADMIN], code: RoleCode.SUPER_ADMIN, name: 'SUPER ADMIN', description: 'Full system governance, security configuration, role management, and unrestricted institutional oversight.', created_at: now, updated_at: now },
    { id: ROLE_IDS[RoleCode.ADMIN], code: RoleCode.ADMIN, name: 'ADMIN', description: 'Institutional administrator managing scientist accounts, reference tables, projects, funding, and system imports/exports.', created_at: now, updated_at: now },
    { id: ROLE_IDS[RoleCode.DIRECTOR], code: RoleCode.DIRECTOR, name: 'DIRECTOR / OVERALL MANAGEMENT', description: 'Executive leadership with institution-wide analytics, project/report approval authority, and strategic oversight.', created_at: now, updated_at: now },
    { id: ROLE_IDS[RoleCode.HEAD_OCS], code: RoleCode.HEAD_OCS, name: 'HEAD OF OCEANS & COASTAL SYSTEMS', description: 'Directorate head overseeing Oceans & Coastal Systems scientists, projects, funding, reports, and marine sites.', created_at: now, updated_at: now },
    { id: ROLE_IDS[RoleCode.SCIENTIST], code: RoleCode.SCIENTIST, name: 'SCIENTIST / RESEARCHER', description: 'Research scientist managing assigned projects, milestones, field activities, technical reports, and publications.', created_at: now, updated_at: now },
    { id: ROLE_IDS[RoleCode.VIEWER], code: RoleCode.VIEWER, name: 'VIEWER', description: 'Read-only stakeholder access to approved dashboards, project portfolios, locations, and published research outputs.', created_at: now, updated_at: now },
  ];

  const permissions = PERMISSION_DEFS.map((p) => ({
    ...p,
    created_at: now,
  }));

  const role_permissions: DatabaseSnapshot['role_permissions'] = [];
  for (const [roleCode, permCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS) as Array<[RoleCode, PermissionCode[]]>) {
    const roleId = ROLE_IDS[roleCode];
    for (const permCode of permCodes) {
      const perm = permissions.find((p) => p.code === permCode);
      if (perm) {
        role_permissions.push({
          id: crypto.randomUUID(),
          role_id: roleId,
          permission_id: perm.id,
          created_at: now,
        });
      }
    }
  }

  const directorates = [
    {
      id: '30000000-0000-4000-8000-000000000001',
      code: 'OCS',
      name: 'Oceans and Coastal Systems',
      headquarters: 'Mombasa Headquarters (English Point)',
      description: 'Leads marine ecology, oceanography, coral reef conservation, blue carbon ecosystems, and Exclusive Economic Zone (EEZ) fisheries research.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '30000000-0000-4000-8000-000000000002',
      code: 'FWS',
      name: 'Freshwater Systems',
      headquarters: 'Kisumu Research Centre',
      description: 'Coordinates limnological, stock assessment, and catchment biodiversity research across Lake Victoria, Lake Turkana, Lake Baringo, and Lake Naivasha.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '30000000-0000-4000-8000-000000000003',
      code: 'ARD',
      name: 'Aquaculture Research and Development',
      headquarters: 'Sagana Aquaculture Centre',
      description: 'Focuses on mariculture, freshwater fish breeding, feed formulation, aquatic animal health, and post-harvest value addition.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '30000000-0000-4000-8000-000000000004',
      code: 'SPG',
      name: 'Socio-Economics, Policy and Governance',
      headquarters: 'Mombasa Headquarters',
      description: 'Conducts socio-economic valuation, marine spatial planning, BMU co-management studies, and Blue Economy policy advisory.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '30000000-0000-4000-8000-000000000005',
      code: 'LAB',
      name: 'Aquatic Environment & Quality Laboratories',
      headquarters: 'Mombasa & Kisumu Analytical Labs',
      description: 'Provides ISO-accredited water quality, heavy metal toxicology, microplastics, and fish safety analytical services.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  const research_areas = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      code: 'OCS-REEF',
      name: 'Coral Reef Ecology & Benthic Dynamics',
      directorate_id: '30000000-0000-4000-8000-000000000001',
      description: 'Thermal bleaching monitoring, reef resilience assessment, and benthic habitat restoration along the Kenyan coast.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      code: 'OCS-OCEAN',
      name: 'Physical, Chemical & Biological Oceanography',
      directorate_id: '30000000-0000-4000-8000-000000000001',
      description: 'Western Indian Ocean circulation, upwelling productivity, ocean acidification, and RV Mtafiti offshore hydrographic surveys.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '40000000-0000-4000-8000-000000000003',
      code: 'OCS-CARBON',
      name: 'Mangrove & Seagrass Blue Carbon Systems',
      directorate_id: '30000000-0000-4000-8000-000000000001',
      description: 'Carbon sequestration accounting, Gazi Bay mangrove restoration, and seagrass meadow mapping.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '40000000-0000-4000-8000-000000000004',
      code: 'OCS-FISH',
      name: 'Marine Stock Assessment & Pelagic Fisheries',
      directorate_id: '30000000-0000-4000-8000-000000000001',
      description: 'Artisanal and offshore tuna/pelagic stock assessments, catch-effort analytics, and bycatch mitigation.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '40000000-0000-4000-8000-000000000005',
      code: 'FWS-LIMN',
      name: 'Inland Waters Limnology & Catchment Ecology',
      directorate_id: '30000000-0000-4000-8000-000000000002',
      description: 'Eutrophication tracking, invasive macrophyte dynamics, and freshwater biodiversity monitoring.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '40000000-0000-4000-8000-000000000006',
      code: 'ARD-MARI',
      name: 'Coastal Mariculture & Seed Production',
      directorate_id: '30000000-0000-4000-8000-000000000003',
      description: 'Seaweed farming, mud crab fattening, marine finfish hatchery protocols, and cage culture sustainability.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '40000000-0000-4000-8000-000000000007',
      code: 'SPG-MSP',
      name: 'Marine Spatial Planning & Blue Economy Governance',
      directorate_id: '30000000-0000-4000-8000-000000000004',
      description: 'Coastal community livelihoods, Beach Management Unit (BMU) governance, and EEZ spatial zoning.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '40000000-0000-4000-8000-000000000008',
      code: 'LAB-ECOTOX',
      name: 'Marine Pollution, Ecotoxicology & Post-Harvest Safety',
      directorate_id: '30000000-0000-4000-8000-000000000005',
      description: 'Microplastic pollution baselines, heavy metal bioaccumulation, and post-harvest value chain quality assurance.',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  // System Bootstrap Account (Non-operational system account for initial login & administration)
  const bootstrapAdmin: UserProfile = {
    id: '00000000-0000-4000-8000-000000000001',
    staff_number: 'SYS-BOOTSTRAP-01',
    email: 'sysadmin@kmfri.go.ke',
    full_name: 'KMFRI System Administrator',
    title: 'Sys.',
    position: 'Chief Information & Governance Administrator',
    role_id: ROLE_IDS[RoleCode.SUPER_ADMIN],
    role_code: RoleCode.SUPER_ADMIN,
    directorate_id: null,
    research_area_id: null,
    phone: '+254 20 8021560',
    office_station: 'Mombasa Headquarters (English Point)',
    is_active: true,
    is_operational_scientist: false, // Strictly non-operational system bootstrap account
    last_login_at: null,
    password_reset_required: false,
    created_at: now,
    updated_at: now,
  };

  const system_settings = [
    {
      id: '50000000-0000-4000-8000-000000000001',
      setting_key: 'institution_profile',
      setting_value: {
        name: 'Kenya Marine and Fisheries Research Institute',
        shortName: 'KMFRI',
        ministry: 'Ministry of Mining, Blue Economy and Maritime Affairs',
        headquarters: 'English Point, Mkomani, Mombasa, Kenya',
        website: 'https://www.kmfri.go.ke',
      },
      category: 'General',
      description: 'Official institutional identity and parent ministry metadata',
      updated_by: null,
      updated_at: now,
    },
    {
      id: '50000000-0000-4000-8000-000000000002',
      setting_key: 'reporting_policy',
      setting_value: {
        autoFlagOverdue: true,
        reminderDaysBeforeDue: 7,
        gracePeriodDays: 0,
        requireAttachmentOnSubmit: false,
      },
      category: 'Reports',
      description: 'Automated deadline and overdue report governance rules',
      updated_by: null,
      updated_at: now,
    },
    {
      id: '50000000-0000-4000-8000-000000000003',
      setting_key: 'storage_policy',
      setting_value: {
        maxFileSizeMB: 25,
        allowedExtensions: ['.pdf', '.docx', '.xlsx', '.csv', '.geojson', '.png', '.jpg'],
      },
      category: 'Storage',
      description: 'Document upload validation constraints and permitted file formats',
      updated_by: null,
      updated_at: now,
    },
    {
      id: '50000000-0000-4000-8000-000000000004',
      setting_key: 'financial_policy',
      setting_value: {
        defaultCurrency: 'KES',
        supportedCurrencies: ['KES', 'USD', 'EUR', 'GBP'],
        fiscalYearStartMonth: 7,
      },
      category: 'Finance',
      description: 'Default currency and Government of Kenya fiscal year calendar (July - June)',
      updated_by: null,
      updated_at: now,
    },
  ];

  // Strictly empty operational tables as mandated by the specification
  return {
    roles,
    permissions,
    role_permissions,
    directorates,
    research_areas,
    users: [bootstrapAdmin],
    funders: [],
    projects: [],
    project_members: [],
    project_milestones: [],
    funding: [],
    locations: [],
    project_locations: [],
    collaborators: [],
    project_collaborators: [],
    reports: [],
    research_outputs: [],
    output_authors: [],
    documents: [],
    shared_folders: [],
    chat_messages: [],
    research_activities: [],
    notifications: [],
    audit_logs: [
      {
        id: crypto.randomUUID(),
        actor_user_id: bootstrapAdmin.id,
        actor_email: bootstrapAdmin.email,
        actor_role: RoleCode.SUPER_ADMIN,
        action: 'SYSTEM_SEED_REFERENCE_DATA',
        entity_type: 'system',
        entity_id: null,
        summary: 'Initialized non-operational reference data (roles, permissions, directorates, research areas, system settings). Operational tables initialized empty.',
        metadata: { operationalRecordsSeeded: 0 },
        ip_address: '127.0.0.1',
        created_at: now,
      },
    ],
    system_settings,
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadDatabase(): DatabaseSnapshot {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial = createReferenceSeedDatabase();
    saveDatabase(initial);
    // Bootstrap credential: no password is hardcoded in source. Use
    // KMFRI_INITIAL_ADMIN_PASSWORD, or read the generated password from the server log.
    const bootstrapPassword = resolveInitialAdminPassword();
    const initialCreds: AuthCredentialRecord[] = [
      {
        user_id: '00000000-0000-4000-8000-000000000001',
        email: 'sysadmin@kmfri.go.ke',
        password_hash: hashPassword(bootstrapPassword),
      },
    ];
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(initialCreds, null, 2), 'utf-8');
    if (!process.env.KMFRI_INITIAL_ADMIN_PASSWORD) {
      console.warn(
        `[auth] Bootstrap admin "sysadmin@kmfri.go.ke" created. Generated password: ${bootstrapPassword}\n` +
          '       Set KMFRI_INITIAL_ADMIN_PASSWORD to choose this yourself, then change it after first sign-in.'
      );
    }
    return initial;
  }

  const raw = stripBom(fs.readFileSync(DB_FILE, 'utf-8'));
  const db: DatabaseSnapshot = JSON.parse(raw);

  let modified = false;
  if (!Array.isArray(db.shared_folders)) {
    db.shared_folders = [];
    modified = true;
  }
  if (!Array.isArray(db.chat_messages)) {
    db.chat_messages = [];
    modified = true;
  }
  if (!Array.isArray(db.email_dispatches)) {
    db.email_dispatches = [];
    modified = true;
  }

  // Ensure system administrator accounts exist
  const now = new Date().toISOString();
  const adminAccounts = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      staff: 'SYS-BOOTSTRAP-01',
      email: 'sysadmin@kmfri.go.ke',
      name: 'KMFRI System Administrator',
      position: 'Chief Information & Governance Administrator',
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      staff: 'SYS-ADMIN-02',
      email: 'admin@kmfri.go.ke',
      name: 'KMFRI Institutional Administrator',
      position: 'Senior Systems Administrator',
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      staff: 'SYS-ADMIN-03',
      email: 'montanacode953@gmail.com',
      name: 'System Administrator (Montana)',
      position: 'Lead Systems Engineer & Administrator',
    },
  ];

  for (const adm of adminAccounts) {
    const existing = db.users.find((u) => u.email.toLowerCase() === adm.email.toLowerCase());
    if (!existing) {
      db.users.push({
        id: adm.id,
        staff_number: adm.staff,
        email: adm.email,
        full_name: adm.name,
        title: 'Sys.',
        position: adm.position,
        role_id: ROLE_IDS[RoleCode.SUPER_ADMIN],
        role_code: RoleCode.SUPER_ADMIN,
        directorate_id: null,
        research_area_id: null,
        phone: '+254 20 8021560',
        office_station: 'Mombasa Headquarters (English Point)',
        is_active: true,
        is_operational_scientist: false,
        last_login_at: null,
        password_reset_required: false,
        created_at: now,
        updated_at: now,
      });
      modified = true;
    }
  }

  // Automate overdue report status evaluation on read
  const today = new Date().toISOString().split('T')[0];
  for (const report of db.reports) {
    const shouldBeOverdue =
      report.due_date < today &&
      report.status !== ReportStatus.APPROVED;
    if (report.is_overdue !== shouldBeOverdue) {
      report.is_overdue = shouldBeOverdue;
      modified = true;
    }
  }

  // Daily audit trail lifecycle check
  const auditSetting = db.system_settings.find((s) => s.setting_key === 'audit_daily_lifecycle');
  const lastRefreshDate = auditSetting?.setting_value?.last_refresh_date as string | undefined;
  if (!auditSetting || lastRefreshDate !== today) {
    performDailyAuditMaintenance(db);
    modified = false; // performDailyAuditMaintenance already calls saveDatabase
  }

  if (modified) {
    saveDatabase(db);
  }
  return db;
}

export function performDailyAuditMaintenance(
  db: DatabaseSnapshot,
  force = false
): { refreshed: boolean; date: string; lastRefreshedAt: string; message: string } {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  let setting = db.system_settings.find((s) => s.setting_key === 'audit_daily_lifecycle');
  const lastRefreshDate = setting?.setting_value?.last_refresh_date as string | undefined;

  if (force || !setting || lastRefreshDate !== today) {
    if (!setting) {
      setting = {
        id: crypto.randomUUID(),
        setting_key: 'audit_daily_lifecycle',
        setting_value: {
          last_refresh_date: today,
          last_refreshed_at: now,
          status: 'ACTIVE',
          cycle_interval: '24h',
        },
        category: 'Audit & Compliance',
        description: 'Automated 24-hour daily audit trail synchronization and lifecycle refresh policy',
        updated_by: null,
        updated_at: now,
      };
      db.system_settings.push(setting);
    } else {
      setting.setting_value = {
        ...setting.setting_value,
        last_refresh_date: today,
        last_refreshed_at: now,
        status: 'ACTIVE',
      };
      setting.updated_at = now;
    }

    appendAuditLog(db, {
      actor: null,
      action: 'AUDIT_LOGS_DAILY_REFRESH',
      entity_type: 'audit',
      entity_id: setting.id,
      summary: `Automated daily audit trail lifecycle refreshed and synchronized for ${today}`,
      metadata: {
        cycle_date: today,
        timestamp: now,
        total_events: db.audit_logs.length,
        forced: force,
      },
      ip_address: '127.0.0.1',
    });

    saveDatabase(db);
    return {
      refreshed: true,
      date: today,
      lastRefreshedAt: now,
      message: `Daily audit trail refreshed successfully for ${today}`,
    };
  }

  return {
    refreshed: false,
    date: today,
    lastRefreshedAt: (setting.setting_value.last_refreshed_at as string) || now,
    message: `Audit logs are already synchronized for today (${today})`,
  };
}

export function saveDatabase(db: DatabaseSnapshot): void {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  // Dual-write: the JSON snapshot stays authoritative, Supabase/PostgreSQL is mirrored.
  scheduleSupabaseMirror(db);
}

export function loadCredentials(): AuthCredentialRecord[] {
  ensureDataDir();
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    loadDatabase();
  }
  const raw = stripBom(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
  let creds: AuthCredentialRecord[] = JSON.parse(raw);
  let modified = false;

  const adminDefaults = [
    { email: 'sysadmin@kmfri.go.ke', id: '00000000-0000-4000-8000-000000000001' },
    { email: 'admin@kmfri.go.ke', id: '00000000-0000-4000-8000-000000000002' },
    { email: 'montanacode953@gmail.com', id: '00000000-0000-4000-8000-000000000003' },
  ];

  for (const adm of adminDefaults) {
    const existing = creds.find((c) => c.email.toLowerCase() === adm.email.toLowerCase());
    if (!existing) {
      const generated = resolveInitialAdminPassword();
      creds.push({
        user_id: adm.id,
        email: adm.email,
        password_hash: hashPassword(generated),
      });
      modified = true;
      if (!process.env.KMFRI_INITIAL_ADMIN_PASSWORD) {
        console.warn(
          `[auth] Bootstrap admin "${adm.email}" created. Generated password: ${generated}`
        );
      }
    }
  }

  if (modified) {
    saveCredentials(creds);
  }

  return creds;
}

export function saveCredentials(creds: AuthCredentialRecord[]): void {
  ensureDataDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
}

export function appendAuditLog(
  db: DatabaseSnapshot,
  params: {
    actor: UserProfile | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
  }
): AuditLog {
  const entry: AuditLog = {
    id: crypto.randomUUID(),
    actor_user_id: params.actor?.id ?? null,
    actor_email: params.actor?.email ?? 'anonymous@kmfri.go.ke',
    actor_role: params.actor?.role_code ?? 'UNAUTHENTICATED',
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    summary: params.summary,
    metadata: params.metadata ?? {},
    ip_address: params.ip_address ?? '127.0.0.1',
    created_at: new Date().toISOString(),
  };
  db.audit_logs.unshift(entry);
  return entry;
}

export function appendNotification(
  db: DatabaseSnapshot,
  params: {
    recipient_user_id: string | null;
    category: NotificationItem['category'];
    title: string;
    message: string;
    entity_type?: string | null;
    entity_id?: string | null;
  }
): NotificationItem {
  const notif: NotificationItem = {
    id: crypto.randomUUID(),
    recipient_user_id: params.recipient_user_id,
    category: params.category,
    title: params.title,
    message: params.message,
    entity_type: params.entity_type ?? null,
    entity_id: params.entity_id ?? null,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  db.notifications.unshift(notif);
  return notif;
}

export function userHasPermission(db: DatabaseSnapshot, user: UserProfile, permission: PermissionCode): boolean {
  if (user.role_code === RoleCode.SUPER_ADMIN) return true;
  const perm = db.permissions.find((p) => p.code === permission);
  if (!perm) return false;
  return db.role_permissions.some(
    (rp) => rp.role_id === user.role_id && rp.permission_id === perm.id
  );
}

export function dispatchInstitutionalEmail(
  db: DatabaseSnapshot,
  params: {
    recipient_email: string;
    recipient_name: string;
    subject: string;
    type: EmailDispatch['type'];
    body_html: string;
    body_text: string;
    metadata?: Record<string, any>;
  }
): EmailDispatch {
  if (!Array.isArray(db.email_dispatches)) {
    db.email_dispatches = [];
  }
  const emailItem: EmailDispatch = {
    id: crypto.randomUUID(),
    recipient_email: params.recipient_email,
    recipient_name: params.recipient_name,
    subject: params.subject,
    type: params.type,
    body_html: params.body_html,
    body_text: params.body_text,
    status: 'DELIVERED',
    sent_at: new Date().toISOString(),
    metadata: params.metadata,
  };
  db.email_dispatches.unshift(emailItem);
  return emailItem;
}
