export type RoleName =
  | 'SUPER ADMIN'
  | 'ADMIN'
  | 'DIRECTOR/OVERALL MANAGEMENT'
  | 'HEAD OF OCEANS & COASTAL SYSTEMS'
  | 'SCIENTIST/RESEARCHER'
  | 'VIEWER';

export const ROLE_NAMES: RoleName[] = [
  'SUPER ADMIN',
  'ADMIN',
  'DIRECTOR/OVERALL MANAGEMENT',
  'HEAD OF OCEANS & COASTAL SYSTEMS',
  'SCIENTIST/RESEARCHER',
  'VIEWER',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  'SUPER ADMIN': [
    'manage_system',
    'manage_users',
    'manage_projects',
    'approve_projects',
    'update_own_projects',
    'manage_funding',
    'submit_reports',
    'review_reports',
    'manage_locations',
    'manage_collaborators',
    'manage_outputs',
    'manage_documents',
    'export_data',
    'view_analytics',
  ],
  ADMIN: [
    'manage_users',
    'manage_projects',
    'approve_projects',
    'update_own_projects',
    'manage_funding',
    'submit_reports',
    'review_reports',
    'manage_locations',
    'manage_collaborators',
    'manage_outputs',
    'manage_documents',
    'export_data',
    'view_analytics',
  ],
  'DIRECTOR/OVERALL MANAGEMENT': [
    'approve_projects',
    'review_reports',
    'export_data',
    'view_analytics',
  ],
  'HEAD OF OCEANS & COASTAL SYSTEMS': [
    'manage_projects',
    'approve_projects',
    'update_own_projects',
    'submit_reports',
    'review_reports',
    'manage_outputs',
    'manage_documents',
    'export_data',
    'view_analytics',
  ],
  'SCIENTIST/RESEARCHER': [
    'update_own_projects',
    'submit_reports',
    'manage_outputs',
    'manage_documents',
    'export_data',
    'view_analytics',
  ],
  VIEWER: ['view_analytics', 'export_data'],
};

export function hasPermission(
  roleName: string | undefined | null,
  userPermissions: string[] | undefined,
  requiredPermission: string
): boolean {
  if (!roleName) return false;
  if (roleName === 'SUPER ADMIN') return true;
  if (userPermissions && userPermissions.includes(requiredPermission)) {
    return true;
  }
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleName as RoleName];
  return defaults ? defaults.includes(requiredPermission) : false;
}

export function canManageUsers(roleName?: string | null, perms?: string[]): boolean {
  return hasPermission(roleName, perms, 'manage_users');
}

export function canApproveProject(
  roleName?: string | null,
  perms?: string[],
  userDirectorateCode?: string | null,
  projectDirectorateCode?: string | null
): boolean {
  if (!roleName) return false;
  if (
    roleName === 'SUPER ADMIN' ||
    roleName === 'ADMIN' ||
    roleName === 'DIRECTOR/OVERALL MANAGEMENT'
  ) {
    return true;
  }
  if (roleName === 'HEAD OF OCEANS & COASTAL SYSTEMS') {
    return !projectDirectorateCode || projectDirectorateCode === 'OCS' || userDirectorateCode === projectDirectorateCode;
  }
  return hasPermission(roleName, perms, 'approve_projects');
}

export function canEditProject(
  userId: string | undefined,
  roleName: string | undefined | null,
  principalInvestigatorId: string | null | undefined,
  memberUserIds: string[] = []
): boolean {
  if (!userId || !roleName) return false;
  if (roleName === 'VIEWER') return false;
  if (
    roleName === 'SUPER ADMIN' ||
    roleName === 'ADMIN' ||
    roleName === 'HEAD OF OCEANS & COASTAL SYSTEMS'
  ) {
    return true;
  }
  if (roleName === 'SCIENTIST/RESEARCHER') {
    return principalInvestigatorId === userId || memberUserIds.includes(userId);
  }
  return false;
}

export function canReviewReport(
  roleName?: string | null,
  perms?: string[]
): boolean {
  if (!roleName) return false;
  if (
    roleName === 'SUPER ADMIN' ||
    roleName === 'ADMIN' ||
    roleName === 'DIRECTOR/OVERALL MANAGEMENT' ||
    roleName === 'HEAD OF OCEANS & COASTAL SYSTEMS'
  ) {
    return true;
  }
  return hasPermission(roleName, perms, 'review_reports');
}

export function isReportOverdue(
  dueDate: string,
  status: string,
  referenceDate: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (!dueDate) return false;
  if (status === 'Approved') return false;
  // If still Draft or Rejected past due date, or not yet submitted/approved past due date
  if (status === 'Draft' || status === 'Rejected' || status === 'Submitted' || status === 'Under Review') {
    return dueDate < referenceDate;
  }
  return false;
}

export function daysUntilDate(
  targetDate: string,
  referenceDate: string = new Date().toISOString().slice(0, 10)
): number {
  const t = new Date(targetDate + 'T00:00:00Z').getTime();
  const r = new Date(referenceDate + 'T00:00:00Z').getTime();
  if (Number.isNaN(t) || Number.isNaN(r)) return 0;
  return Math.round((t - r) / (1000 * 60 * 60 * 24));
}

export function calculateRemainingFunding(
  allocatedAmount: number | string,
  spentAmount: number | string
): number {
  const allocated = Number(allocatedAmount) || 0;
  const spent = Number(spentAmount) || 0;
  return Math.max(0, Number((allocated - spent).toFixed(2)));
}

export function calculateUtilizationPercent(
  allocatedAmount: number | string,
  spentAmount: number | string
): number {
  const allocated = Number(allocatedAmount) || 0;
  const spent = Number(spentAmount) || 0;
  if (allocated <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((spent / allocated) * 100)));
}

const EXCHANGE_RATES_TO_KES: Record<string, number> = {
  KES: 1,
  USD: 129.5,
  EUR: 141.2,
  GBP: 166.8,
};

export function normalizeCurrencyToKES(
  amount: number | string,
  currency: string = 'KES'
): number {
  const num = Number(amount) || 0;
  const rate = EXCHANGE_RATES_TO_KES[currency.toUpperCase()] ?? 1;
  return Number((num * rate).toFixed(2));
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateUserInput(input: {
  fullName?: string;
  email?: string;
  staffNumber?: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!input.fullName || input.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters.');
  }
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.push('A valid institutional email address is required.');
  }
  if (input.staffNumber !== undefined && input.staffNumber.trim().length === 0) {
    errors.push('Staff number cannot be empty when provided.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateProjectInput(input: {
  projectCode?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  budget?: number | string;
  progressPercent?: number;
}): ValidationResult {
  const errors: string[] = [];
  if (!input.projectCode || input.projectCode.trim().length < 3) {
    errors.push('Project code is required (min 3 characters).');
  }
  if (!input.title || input.title.trim().length < 4) {
    errors.push('Project title is required (min 4 characters).');
  }
  if (!input.startDate || !input.endDate) {
    errors.push('Start date and end date are required.');
  } else if (input.endDate < input.startDate) {
    errors.push('End date cannot be earlier than start date.');
  }
  if (input.budget !== undefined && Number(input.budget) < 0) {
    errors.push('Budget cannot be negative.');
  }
  if (
    input.progressPercent !== undefined &&
    (input.progressPercent < 0 || input.progressPercent > 100)
  ) {
    errors.push('Progress percentage must be between 0 and 100.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateFundingInput(input: {
  grantNumber?: string;
  projectId?: string;
  funderId?: string;
  amount?: number | string;
  allocatedAmount?: number | string;
  spentAmount?: number | string;
}): ValidationResult {
  const errors: string[] = [];
  if (!input.grantNumber || input.grantNumber.trim().length < 2) {
    errors.push('Unique grant number is required.');
  }
  if (!input.projectId) {
    errors.push('Project assignment is required.');
  }
  if (!input.funderId) {
    errors.push('Funder organization is required.');
  }
  const amount = Number(input.amount ?? 0);
  const allocated = Number(input.allocatedAmount ?? 0);
  const spent = Number(input.spentAmount ?? 0);
  if (amount < 0 || allocated < 0 || spent < 0) {
    errors.push('Financial amounts cannot be negative.');
  }
  if (allocated > amount && amount > 0) {
    errors.push('Allocated amount cannot exceed total grant amount.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateLocationInput(input: {
  name?: string;
  county?: string;
  site?: string;
  latitude?: number | string;
  longitude?: number | string;
  marineArea?: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length < 2) {
    errors.push('Location name is required.');
  }
  if (!input.county || input.county.trim().length < 2) {
    errors.push('County is required.');
  }
  if (!input.site || input.site.trim().length < 2) {
    errors.push('Site name is required.');
  }
  if (!input.marineArea || input.marineArea.trim().length < 2) {
    errors.push('Marine/Freshwater area classification is required.');
  }
  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    errors.push('Latitude must be a valid coordinate between -90 and 90.');
  }
  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    errors.push('Longitude must be a valid coordinate between -180 and 180.');
  }
  return { valid: errors.length === 0, errors };
}

export function generateCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const escapeCell = (cell: string | number | boolean | null | undefined) => {
    const str = cell === null || cell === undefined ? '' : String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.map(escapeCell).join(',');
  const bodyLines = rows.map((row) => row.map(escapeCell).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

export interface BscPerspectiveScore {
  perspective:
    | 'Research Project Execution (35%)'
    | 'Publications & Intellectual Output (25%)'
    | 'Financial Stewardship & Grant Mobilization (20%)'
    | 'Cruises, Field Expeditions & Scientific Events (20%)';
  maxScore: number;
  earnedScore: number;
  percentage: number;
  summary: string;
  items: { label: string; points: string; status: string }[];
}

export interface ScientistBalancedScorecard {
  scientistId: string;
  totalScore: number; // 0 - 100
  grade: 'Distinguished (A+)' | 'Exceeds Expectations (A)' | 'Meets Targets (B+)' | 'Developing (B)' | 'Baseline (C)';
  rankBadge: string;
  projectExecutionScore: number; // max 35
  publicationsOutputScore: number; // max 25
  financialGrantScore: number; // max 20
  eventsActivitiesScore: number; // max 20
  perspectives: BscPerspectiveScore[];
  metrics: {
    ledProjectsCount: number;
    teamProjectsCount: number;
    avgProjectProgress: number;
    onTimeReportsCount: number;
    overdueReportsCount: number;
    publicationsCount: number;
    publishedCount: number;
    grantsMobilizedKES: number;
    avgGrantUtilization: number;
    completedEventsCount: number;
    totalEventsCount: number;
    coAuthoredDocsCount: number;
  };
}

export function calculateScientistBalancedScorecard(input: {
  scientistId: string;
  projects: {
    id: string;
    code?: string;
    projectCode?: string;
    title: string;
    principalInvestigatorId: string | null;
    memberUserIds?: string[];
    progressPercent: number;
    status: string;
  }[];
  reports: {
    id: string;
    projectId: string;
    submittedBy?: string | null;
    scientistId?: string | null;
    title: string;
    dueDate: string;
    status: string;
    isOverdue?: boolean;
  }[];
  outputs: {
    id: string;
    projectId: string | null;
    authorId?: string | null;
    leadScientistId?: string | null;
    title: string;
    outputType: string;
    publicationStatus?: string;
    status?: string;
  }[];
  funding: {
    id: string;
    projectId: string;
    grantNumber: string;
    amount: string | number;
    allocatedAmount: string | number;
    spentAmount: string | number;
    currency: string;
  }[];
  activities: {
    id: string;
    projectId: string | null;
    scientistId: string | null;
    title: string;
    eventType?: string;
    activityDate: string;
    location?: string | null;
    locationId?: string | null;
    status: string;
    scoreWeight?: number;
  }[];
  documents?: {
    id: string;
    uploadedBy: string | null;
    lastEditedBy?: string | null;
    name: string;
    type: string;
  }[];
}): ScientistBalancedScorecard {
  const {
    scientistId,
    projects = [],
    reports = [],
    outputs = [],
    funding = [],
    activities = [],
    documents = [],
  } = input;

  // 1. Research Project Execution & Delivery (Max 35 pts)
  const ledProjects = projects.filter((p) => p.principalInvestigatorId === scientistId);
  const teamProjects = projects.filter(
    (p) =>
      p.principalInvestigatorId !== scientistId &&
      (p.memberUserIds || []).includes(scientistId)
  );
  const allInvolvedProjects = [...ledProjects, ...teamProjects];
  const involvedProjectIds = new Set(allInvolvedProjects.map((p) => p.id));

  const avgProjectProgress =
    allInvolvedProjects.length > 0
      ? Math.round(
          allInvolvedProjects.reduce((acc, p) => acc + (Number(p.progressPercent) || 0), 0) /
            allInvolvedProjects.length
        )
      : 0;

  const sciReports = reports.filter(
    (r) =>
      r.submittedBy === scientistId ||
      r.scientistId === scientistId ||
      involvedProjectIds.has(r.projectId)
  );
  const onTimeReports = sciReports.filter(
    (r) => r.status === 'Approved' || (r.status === 'Submitted' && !r.isOverdue)
  );
  const overdueReports = sciReports.filter((r) =>
    r.isOverdue !== undefined ? Boolean(r.isOverdue) : isReportOverdue(r.dueDate, r.status)
  );

  const piBonus = Math.min(12, ledProjects.length * 6);
  const teamBonus = Math.min(6, teamProjects.length * 3);
  const progressPts = Math.round((avgProjectProgress / 100) * 12);
  const reportCompliancePts =
    sciReports.length > 0
      ? Math.max(
          0,
          Math.min(5, Math.round((onTimeReports.length / sciReports.length) * 5) - overdueReports.length)
        )
      : allInvolvedProjects.length > 0
        ? 3
        : 0;

  const projectExecutionScore = Math.min(
    35,
    piBonus + teamBonus + progressPts + reportCompliancePts
  );

  // 2. Scientific Publications & Intellectual Output (Max 25 pts)
  const sciOutputs = outputs.filter(
    (o) =>
      o.authorId === scientistId ||
      o.leadScientistId === scientistId ||
      (o.projectId ? involvedProjectIds.has(o.projectId) : false)
  );
  const publishedOutputs = sciOutputs.filter((o) => {
    const st = o.publicationStatus || o.status || '';
    return st === 'Published' || st === 'Peer Review';
  });
  const coAuthoredDocs = documents.filter(
    (d) => d.uploadedBy === scientistId || d.lastEditedBy === scientistId
  );

  let rawPubPoints = 0;
  for (const out of sciOutputs) {
    const st = out.publicationStatus || out.status || 'Published';
    if (st === 'Published') rawPubPoints += 9;
    else if (st === 'Peer Review') rawPubPoints += 7;
    else if (st === 'Internal Review') rawPubPoints += 5;
    else rawPubPoints += 4;
  }
  const docCollabBonus = Math.min(4, coAuthoredDocs.length * 2);
  const publicationsOutputScore = Math.min(25, rawPubPoints + docCollabBonus);

  // 3. Financial Stewardship & Grant Mobilization (Max 20 pts)
  const sciGrants = funding.filter((f) => involvedProjectIds.has(f.projectId));
  const grantsMobilizedKES = sciGrants.reduce(
    (sum, g) => sum + normalizeCurrencyToKES(g.amount, g.currency),
    0
  );
  const avgGrantUtilization =
    sciGrants.length > 0
      ? Math.round(
          sciGrants.reduce(
            (sum, g) => sum + calculateUtilizationPercent(g.allocatedAmount, g.spentAmount),
            0
          ) / sciGrants.length
        )
      : 0;

  const grantMobilizationPts =
    grantsMobilizedKES >= 20000000
      ? 10
      : grantsMobilizedKES >= 5000000
        ? 8
        : grantsMobilizedKES > 0
          ? 5
          : 0;
  // Optimal utilization is 50% - 95%
  const utilizationHealthPts =
    sciGrants.length === 0
      ? 0
      : avgGrantUtilization >= 50 && avgGrantUtilization <= 95
        ? 10
        : avgGrantUtilization >= 25
          ? 7
          : 4;
  const financialGrantScore = Math.min(20, grantMobilizationPts + utilizationHealthPts);

  // 4. Field Expeditions, Cruises & Related Scientific Events (Max 20 pts)
  const sciActivities = activities.filter(
    (a) =>
      a.scientistId === scientistId ||
      (a.projectId ? involvedProjectIds.has(a.projectId) : false)
  );
  const completedActivities = sciActivities.filter((a) => a.status === 'Completed');

  let rawEventPoints = 0;
  for (const act of sciActivities) {
    const weight = Number(act.scoreWeight) || 10;
    const statusFactor =
      act.status === 'Completed' ? 0.65 : act.status === 'Ongoing' ? 0.5 : 0.35;
    rawEventPoints += Math.round(weight * statusFactor);
  }
  const eventsActivitiesScore = Math.min(20, rawEventPoints);

  const totalScore = Math.min(
    100,
    projectExecutionScore +
      publicationsOutputScore +
      financialGrantScore +
      eventsActivitiesScore
  );

  let grade: ScientistBalancedScorecard['grade'] = 'Baseline (C)';
  let rankBadge = 'Research Associate Tier';
  if (totalScore >= 85) {
    grade = 'Distinguished (A+)';
    rankBadge = 'Chief Principal Scientist Tier';
  } else if (totalScore >= 72) {
    grade = 'Exceeds Expectations (A)';
    rankBadge = 'Senior Principal Research Fellow';
  } else if (totalScore >= 58) {
    grade = 'Meets Targets (B+)';
    rankBadge = 'Senior Research Scientist';
  } else if (totalScore >= 42) {
    grade = 'Developing (B)';
    rankBadge = 'Research Scientist';
  }

  const perspectives: BscPerspectiveScore[] = [
    {
      perspective: 'Research Project Execution (35%)',
      maxScore: 35,
      earnedScore: projectExecutionScore,
      percentage: Math.round((projectExecutionScore / 35) * 100),
      summary: `${ledProjects.length} PI-led & ${teamProjects.length} team projects (${avgProjectProgress}% avg progress)`,
      items: [
        ...allInvolvedProjects.map((p) => ({
          label: `${p.code || p.projectCode || 'KMFRI'}: ${p.title}`,
          points: `${p.principalInvestigatorId === scientistId ? 'PI (+6)' : 'Co-PI (+3)'} • ${p.progressPercent}%`,
          status: p.status,
        })),
        {
          label: `Technical Report Compliance (${onTimeReports.length}/${sciReports.length} on-time)`,
          points: `+${reportCompliancePts} pts`,
          status: overdueReports.length > 0 ? `${overdueReports.length} Overdue` : 'Compliant',
        },
      ],
    },
    {
      perspective: 'Publications & Intellectual Output (25%)',
      maxScore: 25,
      earnedScore: publicationsOutputScore,
      percentage: Math.round((publicationsOutputScore / 25) * 100),
      summary: `${sciOutputs.length} manuscripts/outputs & ${coAuthoredDocs.length} SharePoint/Word docs`,
      items: [
        ...sciOutputs.map((o) => {
          const st = o.publicationStatus || o.status || 'Published';
          return {
            label: `${o.title} (${o.outputType})`,
            points:
              st === 'Published'
                ? '+9 pts'
                : st === 'Peer Review'
                  ? '+7 pts'
                  : '+5 pts',
            status: st,
          };
        }),
        ...(coAuthoredDocs.length > 0
          ? [
              {
                label: `SharePoint & Word Co-Authored Files (${coAuthoredDocs.length})`,
                points: `+${docCollabBonus} pts`,
                status: 'Synced',
              },
            ]
          : []),
      ],
    },
    {
      perspective: 'Financial Stewardship & Grant Mobilization (20%)',
      maxScore: 20,
      earnedScore: financialGrantScore,
      percentage: Math.round((financialGrantScore / 20) * 100),
      summary: `KES ${(grantsMobilizedKES / 1000000).toFixed(2)}M mobilized (${avgGrantUtilization}% utilization)`,
      items: sciGrants.map((g) => ({
        label: `Grant ${g.grantNumber}`,
        points: `${g.currency} ${Number(g.amount).toLocaleString()}`,
        status: `${calculateUtilizationPercent(g.allocatedAmount, g.spentAmount)}% Utilized`,
      })),
    },
    {
      perspective: 'Cruises, Field Expeditions & Scientific Events (20%)',
      maxScore: 20,
      earnedScore: eventsActivitiesScore,
      percentage: Math.round((eventsActivitiesScore / 20) * 100),
      summary: `${sciActivities.length} research cruises, symposia & stakeholder events (${completedActivities.length} completed)`,
      items: sciActivities.map((a) => ({
        label: `${a.title} (${a.eventType || 'Field Expedition'})`,
        points: `Weight ${a.scoreWeight ?? 10} pts`,
        status: `${a.status} • ${a.activityDate}`,
      })),
    },
  ];

  return {
    scientistId,
    totalScore,
    grade,
    rankBadge,
    projectExecutionScore,
    publicationsOutputScore,
    financialGrantScore,
    eventsActivitiesScore,
    perspectives,
    metrics: {
      ledProjectsCount: ledProjects.length,
      teamProjectsCount: teamProjects.length,
      avgProjectProgress,
      onTimeReportsCount: onTimeReports.length,
      overdueReportsCount: overdueReports.length,
      publicationsCount: sciOutputs.length,
      publishedCount: publishedOutputs.length,
      grantsMobilizedKES,
      avgGrantUtilization,
      completedEventsCount: completedActivities.length,
      totalEventsCount: sciActivities.length,
      coAuthoredDocsCount: coAuthoredDocs.length,
    },
  };
}

