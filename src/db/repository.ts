import { db, ensureDbReady } from './index.ts';
import {
  roles,
  permissions,
  rolePermissions,
  directorates,
  researchAreas,
  users,
  projects,
  projectMembers,
  projectMilestones,
  funders,
  funding,
  locations,
  projectLocations,
  collaborators,
  projectCollaborators,
  reports,
  researchOutputs,
  outputAuthors,
  documents,
  sharedFolders,
  chatMessages,
  researchActivities,
  notifications,
  auditLogs,
  systemSettings,
} from './schema.ts';
import { getOrCreateUser } from './users.ts';
import { eq, desc, and, count } from 'drizzle-orm';
import { DEFAULT_ROLE_PERMISSIONS, RoleName } from '../lib/domain.ts';
import { hashPassword, verifyPassword } from '../lib/password.ts';

function sanitizeDbError(context: string, error: any): never {
  console.error(`Database operation failed [${context}]:`, error);
  const msg = String(error?.message || '');
  if (msg.includes('users_email_unique')) {
    throw new Error('A researcher with this email address already exists.', { cause: error });
  }
  if (msg.includes('users_staff_number_unique')) {
    throw new Error('A researcher with this KMFRI staff number already exists.', { cause: error });
  }
  if (msg.includes('projects_project_code_unique')) {
    throw new Error('A project with this project code already exists.', { cause: error });
  }
  if (msg.includes('funding_grant_number_unique')) {
    throw new Error('A grant allocation with this grant number already exists.', { cause: error });
  }
  if (msg.includes('directorates_code_unique')) {
    throw new Error('A directorate with this code already exists.', { cause: error });
  }
  throw new Error(`Database operation failed (${context}). Please verify your input and try again.`, {
    cause: error,
  });
}

let seedPromise: Promise<void> | null = null;

export async function ensureSeededFoundation() {
  await ensureDbReady();
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      const existingRoles = await db.select().from(roles);
      if (existingRoles.length === 0) {
        await db
          .insert(roles)
          .values([
            {
              name: 'SUPER ADMIN',
              description:
                'Full institutional control, system configuration, RBAC management, audit logs, and all research modules.',
            },
            {
              name: 'ADMIN',
              description:
                'Manage researchers, projects, funding, reports, collaborators, locations, and documents.',
            },
            {
              name: 'DIRECTOR/OVERALL MANAGEMENT',
              description:
                'Institution-wide analytics, strategic oversight, and executive approvals.',
            },
            {
              name: 'HEAD OF OCEANS & COASTAL SYSTEMS',
              description:
                'Directorate-level oversight for Oceans & Coastal Systems, workload, and report reviews.',
            },
            {
              name: 'SCIENTIST/RESEARCHER',
              description:
                'Manage personal/led projects, activities, milestones, outputs, reports, funding, and collaborators.',
            },
            {
              name: 'VIEWER',
              description:
                'Authorized read-only access to institutional dashboards and registries.',
            },
          ])
          .onConflictDoNothing();
      }

      const existingPerms = await db.select().from(permissions);
      if (existingPerms.length === 0) {
        await db
          .insert(permissions)
          .values([
            {
              name: 'manage_users',
              description: 'Create, update, and manage scientist and staff accounts',
            },
            {
              name: 'manage_roles',
              description: 'Configure RBAC roles and permission assignments',
            },
            {
              name: 'approve_projects',
              description: 'Approve, suspend, or archive research projects',
            },
            {
              name: 'create_projects',
              description: 'Propose and manage scientific research projects',
            },
            {
              name: 'manage_funding',
              description: 'Allocate grants, funders, and expenditure records',
            },
            {
              name: 'review_reports',
              description: 'Review, approve, or reject technical and progress reports',
            },
            {
              name: 'submit_reports',
              description: 'Create and submit project reports and research outputs',
            },
            {
              name: 'manage_locations',
              description: 'Add and edit GIS marine and freshwater stations',
            },
            {
              name: 'manage_collaborators',
              description: 'Register partner organizations and MOUs',
            },
            {
              name: 'view_audit_logs',
              description: 'Inspect institutional audit logs and security events',
            },
            {
              name: 'manage_settings',
              description: 'Update KMFRI institutional system configurations',
            },
          ])
          .onConflictDoNothing();
      }

      let allDirs = await db.select().from(directorates);
      if (allDirs.length === 0) {
        allDirs = await db
          .insert(directorates)
          .values([
            {
              name: 'Oceans and Coastal Systems',
              code: 'OCS',
              description:
                'Marine ecology, coral reefs, mangroves, seagrass, oceanography, hydrography, and EEZ fisheries across the Kenyan Indian Ocean coast.',
            },
            {
              name: 'Freshwater Systems',
              code: 'FWS',
              description:
                'Limnology, stock assessment, and catchment ecology across Lake Victoria, Lake Turkana, Lake Naivasha, Lake Baringo, and river basins.',
            },
            {
              name: 'Aquaculture Research & Development',
              code: 'ARD',
              description:
                'Mariculture, freshwater fish farming, selective breeding, fish nutrition, and aquatic animal health.',
            },
            {
              name: 'Socio-Economics & Blue Economy',
              code: 'SBE',
              description:
                'Fisheries value-chain economics, Beach Management Unit (BMU) governance, post-harvest technology, and marine policy.',
            },
          ])
          .returning();
      }

      const ocsDir = allDirs.find((d) => d.code === 'OCS') || allDirs[0];
      const fwsDir = allDirs.find((d) => d.code === 'FWS') || allDirs[0];
      const ardDir = allDirs.find((d) => d.code === 'ARD') || allDirs[0];
      const sbeDir = allDirs.find((d) => d.code === 'SBE') || allDirs[0];

      let allAreas = await db.select().from(researchAreas);
      if (allAreas.length === 0 && ocsDir) {
        allAreas = await db
          .insert(researchAreas)
          .values([
            {
              name: 'Coral Reef, Seagrass & Mangrove Blue Carbon',
              description: 'Coastal blue carbon ecosystems, carbon sequestration, and reef restoration.',
              directorateId: ocsDir.id,
            },
            {
              name: 'Fisheries Stock Assessment & EEZ Hydrography',
              description: 'Pelagic and demersal stock acoustics aboard RV Mtafiti.',
              directorateId: ocsDir.id,
            },
            {
              name: 'Lake Victoria & Great Lakes Limnology',
              description: 'Freshwater biodiversity, eutrophication, and Nile perch stock dynamics.',
              directorateId: fwsDir.id,
            },
            {
              name: 'Marine & Coastal Mariculture Systems',
              description: 'Seaweed, mud crab, milkfish, and Artemia coastal aquaculture.',
              directorateId: ardDir.id,
            },
            {
              name: 'Blue Economy Valuation & BMU Co-Management',
              description: 'Socio-economic impact assessments and coastal community livelihoods.',
              directorateId: sbeDir.id,
            },
          ])
          .returning();
      }

      const allRoles = await db.select().from(roles);
      const superAdminRole = allRoles.find((r) => r.name === 'SUPER ADMIN');

      // One-time production clean-slate purge: remove all dummy operational data and leave ONLY the Super Admin profile
      const cleanFlag = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'production_clean_slate_v2'))
        .limit(1);

      if (cleanFlag.length === 0) {
        await db.delete(chatMessages);
        await db.delete(notifications);
        await db.delete(researchActivities);
        await db.delete(documents);
        await db.delete(sharedFolders);
        await db.delete(outputAuthors);
        await db.delete(researchOutputs);
        await db.delete(reports);
        await db.delete(projectCollaborators);
        await db.delete(collaborators);
        await db.delete(projectLocations);
        await db.delete(locations);
        await db.delete(funding);
        await db.delete(funders);
        await db.delete(projectMilestones);
        await db.delete(projectMembers);
        await db.delete(projects);
        await db.delete(auditLogs);
        await db.update(directorates).set({ headUserId: null });
        await db.delete(users);

        await db.insert(users).values({
          uid: 'kmfri-superadmin-0001',
          authId: hashPassword('kmfri2026'),
          fullName: 'KMFRI System Super Administrator',
          email: 'admin@kmfri.go.ke',
          phone: '+254 700 000 001',
          staffNumber: 'KMFRI-0001',
          position: 'Chief Principal Research Scientist & System Super Administrator',
          directorateId: ocsDir?.id || null,
          researchAreaId: allAreas[0]?.id || null,
          roleId: superAdminRole?.id || null,
          status: 'Active',
        });

        await db
          .insert(systemSettings)
          .values({
            settingKey: 'production_clean_slate_v2',
            settingValue: {
              cleanedAt: new Date().toISOString(),
              mode: 'production',
            },
          })
          .onConflictDoUpdate({
            target: systemSettings.settingKey,
            set: {
              settingValue: {
                cleanedAt: new Date().toISOString(),
                mode: 'production',
              },
              updatedAt: new Date(),
            },
          });
      }

      const existingUsers = await db.select().from(users);
      if (existingUsers.length === 0) {
        await db.insert(users).values({
          uid: 'kmfri-superadmin-0001',
          authId: hashPassword('kmfri2026'),
          fullName: 'KMFRI System Super Administrator',
          email: 'admin@kmfri.go.ke',
          phone: '+254 700 000 001',
          staffNumber: 'KMFRI-0001',
          position: 'Chief Principal Research Scientist & System Super Administrator',
          directorateId: ocsDir?.id || null,
          researchAreaId: allAreas[0]?.id || null,
          roleId: superAdminRole?.id || null,
          status: 'Active',
        });
      }
    } catch (error) {
      seedPromise = null;
      sanitizeDbError('ensureSeededFoundation', error);
    }
  })();

  return seedPromise;
}

export async function getUserProfile(
  uid: string,
  email: string,
  displayName?: string | null,
  photoURL?: string | null
) {
  try {
    await ensureSeededFoundation();
    const user = await getOrCreateUser(uid, email, displayName, photoURL);
    const allRoles = await db.select().from(roles);
    const allPerms = await db.select().from(permissions);
    const allRolePerms = await db.select().from(rolePermissions);
    const allDirs = await db.select().from(directorates);
    const allAreas = await db.select().from(researchAreas);

    const roleObj = allRoles.find((r) => r.id === user.roleId) || allRoles[0];
    const roleName = (roleObj?.name || 'SCIENTIST/RESEARCHER') as RoleName;

    const assignedPermIds = allRolePerms
      .filter((rp) => rp.roleId === roleObj?.id)
      .map((rp) => rp.permissionId);
    const dbPermNames = allPerms
      .filter((p) => assignedPermIds.includes(p.id))
      .map((p) => p.name);

    const effectivePerms =
      dbPermNames.length > 0
        ? dbPermNames
        : DEFAULT_ROLE_PERMISSIONS[roleName] || ['view_analytics'];

    const dirObj = allDirs.find((d) => d.id === user.directorateId) || null;
    const areaObj = allAreas.find((a) => a.id === user.researchAreaId) || null;

    return {
      ...user,
      roleName,
      permissions: effectivePerms,
      directorateName: dirObj?.name || 'Unassigned Directorate',
      directorateCode: dirObj?.code || null,
      researchAreaName: areaObj?.name || 'Unassigned Research Area',
    };
  } catch (error) {
    sanitizeDbError('getUserProfile', error);
  }
}

export async function getBootstrapData(currentUserId: string) {
  try {
    await ensureSeededFoundation();
    const [
      rolesList,
      permissionsList,
      rolePermissionsList,
      directoratesList,
      researchAreasList,
      usersList,
      projectsList,
      projectMembersList,
    ] = await Promise.all([
      db.select().from(roles),
      db.select().from(permissions),
      db.select().from(rolePermissions),
      db.select().from(directorates),
      db.select().from(researchAreas),
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(projects).orderBy(desc(projects.createdAt)),
      db.select().from(projectMembers),
    ]);

    const [
      projectMilestonesList,
      fundersList,
      fundingList,
      locationsList,
      projectLocationsList,
      collaboratorsList,
      projectCollaboratorsList,
      reportsList,
    ] = await Promise.all([
      db.select().from(projectMilestones).orderBy(projectMilestones.dueDate),
      db.select().from(funders),
      db.select().from(funding).orderBy(desc(funding.createdAt)),
      db.select().from(locations).orderBy(desc(locations.createdAt)),
      db.select().from(projectLocations),
      db.select().from(collaborators).orderBy(desc(collaborators.createdAt)),
      db.select().from(projectCollaborators),
      db.select().from(reports).orderBy(desc(reports.createdAt)),
    ]);

    const [
      researchOutputsList,
      outputAuthorsList,
      documentsList,
      sharedFoldersList,
      chatMessagesList,
      researchActivitiesList,
      notificationsList,
      auditLogsList,
      systemSettingsList,
    ] = await Promise.all([
      db.select().from(researchOutputs).orderBy(desc(researchOutputs.createdAt)),
      db.select().from(outputAuthors),
      db.select().from(documents).orderBy(desc(documents.createdAt)),
      db.select().from(sharedFolders).orderBy(desc(sharedFolders.createdAt)),
      db.select().from(chatMessages).orderBy(chatMessages.createdAt).limit(300),
      db.select().from(researchActivities).orderBy(desc(researchActivities.activityDate)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, currentUserId))
        .orderBy(desc(notifications.createdAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(250),
      db.select().from(systemSettings),
    ]);

    return {
      roles: rolesList,
      permissions: permissionsList,
      rolePermissions: rolePermissionsList,
      directorates: directoratesList,
      researchAreas: researchAreasList,
      users: usersList,
      projects: projectsList,
      projectMembers: projectMembersList,
      projectMilestones: projectMilestonesList,
      funders: fundersList,
      funding: fundingList,
      locations: locationsList,
      projectLocations: projectLocationsList,
      collaborators: collaboratorsList,
      projectCollaborators: projectCollaboratorsList,
      reports: reportsList,
      researchOutputs: researchOutputsList,
      outputAuthors: outputAuthorsList,
      documents: documentsList,
      sharedFolders: sharedFoldersList,
      chatMessages: chatMessagesList,
      researchActivities: researchActivitiesList,
      notifications: notificationsList,
      auditLogs: auditLogsList,
      systemSettings: systemSettingsList,
    };
  } catch (error) {
    sanitizeDbError('getBootstrapData', error);
  }
}

export async function logAudit(params: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      ipAddress: params.ipAddress || null,
    });
  } catch (error) {
    console.error('Non-fatal audit log write error:', error);
  }
}

export async function createNotificationRecord(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
}) {
  try {
    const res = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createNotificationRecord', error);
  }
}

// USERS / SCIENTISTS & EMAIL/PASSWORD AUTHENTICATION
export async function authenticateEmailPasswordRecord(
  email: string,
  password: string,
  fullNameIfFirstUser?: string
) {
  try {
    await ensureSeededFoundation();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length === 0) {
      // If only the initial un-claimed default Super Admin exists, allow claiming it on first login;
      // otherwise require accounts to be created by the Super Admin.
      const allUsers = await db.select().from(users);
      if (
        allUsers.length === 1 &&
        allUsers[0].email === 'admin@kmfri.go.ke' &&
        !allUsers[0].lastLogin
      ) {
        const pwHash = hashPassword(password);
        const derivedName =
          fullNameIfFirstUser?.trim() ||
          normalizedEmail
            .split('@')[0]
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
        const updated = await db
          .update(users)
          .set({
            email: normalizedEmail,
            fullName: derivedName,
            authId: pwHash,
            status: 'Active',
            lastLogin: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, allUsers[0].id))
          .returning();
        return updated[0];
      }

      throw new Error(
        'No researcher account found for this email. Accounts must be created by the KMFRI Super Administrator before signing in.'
      );
    }

    const user = existing[0];
    if (user.status === 'Inactive' || user.status === 'Suspended') {
      throw new Error(
        'Your KMFRI researcher account is currently deactivated. Please contact an Institutional Administrator.'
      );
    }

    const storedAuth = user.authId || '';
    if (storedAuth.startsWith('scrypt$') && user.status !== 'PasswordResetRequired') {
      const isValid = verifyPassword(password, storedAuth);
      if (!isValid) {
        throw new Error('Invalid email or password. Please verify your credentials.');
      }
      const updated = await db
        .update(users)
        .set({ lastLogin: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      return updated[0];
    } else {
      // Account was created by Admin without an initial password hash or was marked PasswordResetRequired:
      // Set the researcher's password hash on first login/reset and activate account
      const pwHash = hashPassword(password);
      const updated = await db
        .update(users)
        .set({
          authId: pwHash,
          status: 'Active',
          lastLogin: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
      return updated[0];
    }
  } catch (error: any) {
    if (
      error?.message?.includes('No researcher account') ||
      error?.message?.includes('Invalid email or password') ||
      error?.message?.includes('currently deactivated')
    ) {
      throw error;
    }
    sanitizeDbError('authenticateEmailPasswordRecord', error);
  }
}

export async function selfResetScientistPasswordRecord(
  email: string,
  verificationIdentifier: string,
  newPassword: string
) {
  await ensureSeededFoundation();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('No KMFRI scientist account found with that email address.');
  }

  const user = existing[0];
  const verifyClean = verificationIdentifier.trim().toLowerCase();
  const staffMatch =
    user.staffNumber && user.staffNumber.trim().toLowerCase() === verifyClean;
  const nameMatch = user.fullName.trim().toLowerCase() === verifyClean;

  if (!staffMatch && !nameMatch) {
    throw new Error(
      'Verification failed: Please enter your exact KMFRI Staff Number (e.g. KMFRI-1001) or Full Name registered on your account.'
    );
  }

  const pwHash = hashPassword(newPassword.trim());
  const updated = await db
    .update(users)
    .set({
      authId: pwHash,
      status: user.status === 'PasswordResetRequired' ? 'Active' : user.status,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  return updated[0];
}

export async function changeOwnPasswordRecord(
  userId: string,
  newPassword: string
) {
  const pwHash = hashPassword(newPassword.trim());
  const updated = await db
    .update(users)
    .set({
      authId: pwHash,
      status: 'Active',
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updated[0];
}

export async function createUserRecord(data: {
  fullName: string;
  email: string;
  password?: string;
  phone?: string;
  staffNumber?: string;
  position?: string;
  directorateId?: string | null;
  researchAreaId?: string | null;
  roleId?: string | null;
  status?: string;
  profilePhoto?: string | null;
}) {
  try {
    const normalizedEmail = data.email.trim().toLowerCase();
    const staffNum =
      data.staffNumber?.trim() || `KMFRI-${Math.floor(1000 + Math.random() * 9000)}`;
    const placeholderUid = `pre_${staffNum}_${Date.now()}`;
    const authValue =
      data.password && data.password.trim().length >= 6
        ? hashPassword(data.password.trim())
        : placeholderUid;

    const inserted = await db
      .insert(users)
      .values({
        uid: placeholderUid,
        authId: authValue,
        fullName: data.fullName.trim(),
        email: normalizedEmail,
        phone: data.phone?.trim() || null,
        staffNumber: staffNum,
        position: data.position?.trim() || 'Research Scientist',
        directorateId: data.directorateId || null,
        researchAreaId: data.researchAreaId || null,
        roleId: data.roleId || null,
        status: data.status || 'Active',
        profilePhoto: data.profilePhoto || null,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    sanitizeDbError('createUserRecord', error);
  }
}

export async function updateUserRecord(
  id: string,
  data: {
    fullName?: string;
    email?: string;
    password?: string;
    phone?: string | null;
    staffNumber?: string | null;
    position?: string | null;
    directorateId?: string | null;
    researchAreaId?: string | null;
    roleId?: string | null;
    status?: string;
    profilePhoto?: string | null;
  }
) {
  try {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const passwordUpdate =
      data.password && data.password.trim().length >= 6
        ? { authId: hashPassword(data.password.trim()) }
        : {};

    const updated = await db
      .update(users)
      .set({
        ...(data.fullName !== undefined ? { fullName: data.fullName.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
        ...passwordUpdate,
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.staffNumber !== undefined ? { staffNumber: data.staffNumber } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
        ...(data.directorateId !== undefined ? { directorateId: data.directorateId || null } : {}),
        ...(data.researchAreaId !== undefined
          ? { researchAreaId: data.researchAreaId || null }
          : {}),
        ...(data.roleId !== undefined ? { roleId: data.roleId || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.profilePhoto !== undefined ? { profilePhoto: data.profilePhoto } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return { oldRecord: existing[0], newRecord: updated[0] };
  } catch (error) {
    sanitizeDbError('updateUserRecord', error);
  }
}

export async function switchUserRoleByName(userId: string, roleName: string) {
  try {
    const roleRecord = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);
    if (!roleRecord[0]) {
      throw new Error(`Role ${roleName} not found.`);
    }
    const updated = await db
      .update(users)
      .set({ roleId: roleRecord[0].id, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated[0];
  } catch (error) {
    sanitizeDbError('switchUserRoleByName', error);
  }
}

// PROJECTS
export async function createProjectRecord(
  data: {
    projectCode: string;
    title: string;
    description?: string;
    objectives?: string;
    deliverables?: string;
    risksIssues?: string;
    researchAreaId?: string | null;
    directorateId?: string | null;
    principalInvestigatorId?: string | null;
    startDate: string;
    endDate: string;
    status?: string;
    priority?: string;
    budget?: string | number;
    currency?: string;
    progressPercent?: number;
    locationSummary?: string;
    memberIds?: string[];
    locationIds?: { locationId: string; activityDescription?: string }[];
    collaboratorIds?: { collaboratorId: string; role?: string }[];
  },
  createdByUserId: string
) {
  try {
    const inserted = await db
      .insert(projects)
      .values({
        projectCode: data.projectCode.trim().toUpperCase(),
        title: data.title.trim(),
        description: data.description || null,
        objectives: data.objectives || null,
        deliverables: data.deliverables || null,
        risksIssues: data.risksIssues || null,
        researchAreaId: data.researchAreaId || null,
        directorateId: data.directorateId || null,
        principalInvestigatorId: data.principalInvestigatorId || createdByUserId,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status || 'Proposed',
        priority: data.priority || 'Medium',
        budget: String(data.budget ?? '0'),
        currency: data.currency || 'KES',
        progressPercent: Number(data.progressPercent ?? 0),
        locationSummary: data.locationSummary || null,
        createdBy: createdByUserId,
      })
      .returning();

    const proj = inserted[0];

    if (data.memberIds && data.memberIds.length > 0) {
      for (const uid of data.memberIds) {
        await db.insert(projectMembers).values({
          projectId: proj.id,
          userId: uid,
          role: uid === proj.principalInvestigatorId ? 'Principal Investigator' : 'Co-Investigator',
          startDate: proj.startDate,
          endDate: proj.endDate,
        });
      }
    }

    if (data.locationIds && data.locationIds.length > 0) {
      for (const loc of data.locationIds) {
        await db
          .insert(projectLocations)
          .values({
            projectId: proj.id,
            locationId: loc.locationId,
            activityDescription: loc.activityDescription || 'Field sampling & monitoring',
          })
          .onConflictDoNothing();
      }
    }

    if (data.collaboratorIds && data.collaboratorIds.length > 0) {
      for (const col of data.collaboratorIds) {
        await db
          .insert(projectCollaborators)
          .values({
            projectId: proj.id,
            collaboratorId: col.collaboratorId,
            role: col.role || 'Research Partner',
          })
          .onConflictDoNothing();
      }
    }

    return proj;
  } catch (error) {
    sanitizeDbError('createProjectRecord', error);
  }
}

export async function updateProjectRecord(id: string, data: any) {
  try {
    const existing = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    const updated = await db
      .update(projects)
      .set({
        ...(data.projectCode !== undefined
          ? { projectCode: data.projectCode.trim().toUpperCase() }
          : {}),
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.objectives !== undefined ? { objectives: data.objectives } : {}),
        ...(data.deliverables !== undefined ? { deliverables: data.deliverables } : {}),
        ...(data.risksIssues !== undefined ? { risksIssues: data.risksIssues } : {}),
        ...(data.researchAreaId !== undefined
          ? { researchAreaId: data.researchAreaId || null }
          : {}),
        ...(data.directorateId !== undefined
          ? { directorateId: data.directorateId || null }
          : {}),
        ...(data.principalInvestigatorId !== undefined
          ? { principalInvestigatorId: data.principalInvestigatorId || null }
          : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.budget !== undefined ? { budget: String(data.budget) } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.progressPercent !== undefined
          ? { progressPercent: Number(data.progressPercent) }
          : {}),
        ...(data.locationSummary !== undefined
          ? { locationSummary: data.locationSummary }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (Array.isArray(data.memberIds)) {
      await db.delete(projectMembers).where(eq(projectMembers.projectId, id));
      for (const uid of data.memberIds) {
        await db.insert(projectMembers).values({
          projectId: id,
          userId: uid,
          role:
            uid === updated[0]?.principalInvestigatorId
              ? 'Principal Investigator'
              : 'Co-Investigator',
          startDate: updated[0]?.startDate,
          endDate: updated[0]?.endDate,
        });
      }
    }

    if (Array.isArray(data.locationIds)) {
      await db.delete(projectLocations).where(eq(projectLocations.projectId, id));
      for (const loc of data.locationIds) {
        const locId = typeof loc === 'string' ? loc : loc.locationId;
        const actDesc =
          typeof loc === 'string'
            ? 'Field station monitoring'
            : loc.activityDescription || 'Field station monitoring';
        await db
          .insert(projectLocations)
          .values({
            projectId: id,
            locationId: locId,
            activityDescription: actDesc,
          })
          .onConflictDoNothing();
      }
    }

    if (Array.isArray(data.collaboratorIds)) {
      await db.delete(projectCollaborators).where(eq(projectCollaborators.projectId, id));
      for (const col of data.collaboratorIds) {
        const colId = typeof col === 'string' ? col : col.collaboratorId;
        const colRole = typeof col === 'string' ? 'Research Partner' : col.role || 'Research Partner';
        await db
          .insert(projectCollaborators)
          .values({
            projectId: id,
            collaboratorId: colId,
            role: colRole,
          })
          .onConflictDoNothing();
      }
    }

    return { oldRecord: existing[0], newRecord: updated[0] };
  } catch (error) {
    sanitizeDbError('updateProjectRecord', error);
  }
}

// MILESTONES
export async function createMilestoneRecord(data: {
  projectId: string;
  title: string;
  description?: string;
  dueDate: string;
  completionDate?: string | null;
  status?: string;
  progressPercent?: number;
}) {
  try {
    const res = await db
      .insert(projectMilestones)
      .values({
        projectId: data.projectId,
        title: data.title.trim(),
        description: data.description || null,
        dueDate: data.dueDate,
        completionDate: data.completionDate || null,
        status: data.status || 'Pending',
        progressPercent: Number(data.progressPercent ?? 0),
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createMilestoneRecord', error);
  }
}

export async function updateMilestoneRecord(
  id: string,
  data: {
    title?: string;
    description?: string;
    dueDate?: string;
    completionDate?: string | null;
    status?: string;
    progressPercent?: number;
  }
) {
  try {
    const res = await db
      .update(projectMilestones)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.completionDate !== undefined ? { completionDate: data.completionDate } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.progressPercent !== undefined
          ? { progressPercent: Number(data.progressPercent) }
          : {}),
      })
      .where(eq(projectMilestones.id, id))
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('updateMilestoneRecord', error);
  }
}

export async function deleteMilestoneRecord(id: string) {
  try {
    await db.delete(projectMilestones).where(eq(projectMilestones.id, id));
  } catch (error) {
    sanitizeDbError('deleteMilestoneRecord', error);
  }
}

// RESEARCH ACTIVITIES & BALANCED SCORECARD EVENTS
export async function createActivityRecord(data: {
  projectId?: string | null;
  scientistId: string;
  title: string;
  eventType?: string;
  description?: string;
  activityDate: string;
  locationId?: string | null;
  status?: string;
  hours?: string | number;
  scoreWeight?: number;
}) {
  try {
    const res = await db
      .insert(researchActivities)
      .values({
        projectId: data.projectId || null,
        scientistId: data.scientistId,
        title: data.title.trim(),
        eventType: data.eventType || 'Field Expedition',
        description: data.description || null,
        activityDate: data.activityDate,
        locationId: data.locationId || null,
        status: data.status || 'Completed',
        hours: String(data.hours ?? '0'),
        scoreWeight: Number(data.scoreWeight ?? 10),
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createActivityRecord', error);
  }
}

export async function updateActivityRecord(id: string, data: any) {
  try {
    const res = await db
      .update(researchActivities)
      .set({
        ...(data.projectId !== undefined ? { projectId: data.projectId || null } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.eventType !== undefined ? { eventType: data.eventType } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.activityDate !== undefined ? { activityDate: data.activityDate } : {}),
        ...(data.locationId !== undefined ? { locationId: data.locationId || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.hours !== undefined ? { hours: String(data.hours) } : {}),
        ...(data.scoreWeight !== undefined ? { scoreWeight: Number(data.scoreWeight) } : {}),
      })
      .where(eq(researchActivities.id, id))
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('updateActivityRecord', error);
  }
}

export async function deleteActivityRecord(id: string) {
  try {
    await db.delete(researchActivities).where(eq(researchActivities.id, id));
  } catch (error) {
    sanitizeDbError('deleteActivityRecord', error);
  }
}

// FUNDERS & FUNDING
export async function createFunderRecord(data: {
  name: string;
  type: string;
  country: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
}) {
  try {
    const res = await db
      .insert(funders)
      .values({
        name: data.name.trim(),
        type: data.type,
        country: data.country || 'Kenya',
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createFunderRecord', error);
  }
}

export async function createFundingRecord(data: {
  projectId: string;
  funderId: string;
  grantNumber: string;
  amount: string | number;
  currency?: string;
  awardDate: string;
  startDate: string;
  endDate: string;
  allocatedAmount: string | number;
  spentAmount?: string | number;
  status?: string;
  documentUrl?: string;
  notes?: string;
}) {
  try {
    const res = await db
      .insert(funding)
      .values({
        projectId: data.projectId,
        funderId: data.funderId,
        grantNumber: data.grantNumber.trim().toUpperCase(),
        amount: String(data.amount),
        currency: data.currency || 'USD',
        awardDate: data.awardDate,
        startDate: data.startDate,
        endDate: data.endDate,
        allocatedAmount: String(data.allocatedAmount),
        spentAmount: String(data.spentAmount ?? '0'),
        status: data.status || 'Active',
        documentUrl: data.documentUrl || null,
        notes: data.notes || null,
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createFundingRecord', error);
  }
}

export async function updateFundingRecord(id: string, data: any) {
  try {
    const res = await db
      .update(funding)
      .set({
        ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
        ...(data.funderId !== undefined ? { funderId: data.funderId } : {}),
        ...(data.grantNumber !== undefined
          ? { grantNumber: data.grantNumber.trim().toUpperCase() }
          : {}),
        ...(data.amount !== undefined ? { amount: String(data.amount) } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.awardDate !== undefined ? { awardDate: data.awardDate } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
        ...(data.allocatedAmount !== undefined
          ? { allocatedAmount: String(data.allocatedAmount) }
          : {}),
        ...(data.spentAmount !== undefined ? { spentAmount: String(data.spentAmount) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.documentUrl !== undefined ? { documentUrl: data.documentUrl } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(funding.id, id))
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('updateFundingRecord', error);
  }
}

export async function deleteFundingRecord(id: string) {
  try {
    await db.delete(funding).where(eq(funding.id, id));
  } catch (error) {
    sanitizeDbError('deleteFundingRecord', error);
  }
}

// LOCATIONS
export async function createLocationRecord(data: {
  name: string;
  country?: string;
  county: string;
  subCounty?: string;
  site: string;
  latitude: number | string;
  longitude: number | string;
  marineArea: string;
  description?: string;
  projectId?: string;
  activityDescription?: string;
}) {
  try {
    const res = await db
      .insert(locations)
      .values({
        name: data.name.trim(),
        country: data.country || 'Kenya',
        county: data.county.trim(),
        subCounty: data.subCounty?.trim() || null,
        site: data.site.trim(),
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        marineArea: data.marineArea.trim(),
        description: data.description || null,
      })
      .returning();

    const loc = res[0];
    if (data.projectId) {
      await db
        .insert(projectLocations)
        .values({
          projectId: data.projectId,
          locationId: loc.id,
          activityDescription: data.activityDescription || 'Primary station monitoring',
        })
        .onConflictDoNothing();
    }
    return loc;
  } catch (error) {
    sanitizeDbError('createLocationRecord', error);
  }
}

export async function updateLocationRecord(id: string, data: any) {
  try {
    const res = await db
      .update(locations)
      .set({
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.country !== undefined ? { country: data.country } : {}),
        ...(data.county !== undefined ? { county: data.county } : {}),
        ...(data.subCounty !== undefined ? { subCounty: data.subCounty } : {}),
        ...(data.site !== undefined ? { site: data.site } : {}),
        ...(data.latitude !== undefined ? { latitude: Number(data.latitude) } : {}),
        ...(data.longitude !== undefined ? { longitude: Number(data.longitude) } : {}),
        ...(data.marineArea !== undefined ? { marineArea: data.marineArea } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      })
      .where(eq(locations.id, id))
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('updateLocationRecord', error);
  }
}

export async function deleteLocationRecord(id: string) {
  try {
    await db.delete(locations).where(eq(locations.id, id));
  } catch (error) {
    sanitizeDbError('deleteLocationRecord', error);
  }
}

// COLLABORATORS
export async function createCollaboratorRecord(data: {
  organizationName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  country?: string;
  organizationType: string;
  collaborationType: string;
  startDate?: string;
  endDate?: string;
  mouDocumentUrl?: string;
  notes?: string;
  projectIds?: string[];
}) {
  try {
    const res = await db
      .insert(collaborators)
      .values({
        organizationName: data.organizationName.trim(),
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        country: data.country || 'Kenya',
        organizationType: data.organizationType,
        collaborationType: data.collaborationType,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        mouDocumentUrl: data.mouDocumentUrl || null,
        notes: data.notes || null,
      })
      .returning();

    const col = res[0];
    if (data.projectIds && data.projectIds.length > 0) {
      for (const pid of data.projectIds) {
        await db
          .insert(projectCollaborators)
          .values({
            projectId: pid,
            collaboratorId: col.id,
            role: data.collaborationType || 'Research Partner',
          })
          .onConflictDoNothing();
      }
    }
    return col;
  } catch (error) {
    sanitizeDbError('createCollaboratorRecord', error);
  }
}

export async function updateCollaboratorRecord(id: string, data: any) {
  try {
    const res = await db
      .update(collaborators)
      .set({
        ...(data.organizationName !== undefined
          ? { organizationName: data.organizationName.trim() }
          : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.country !== undefined ? { country: data.country } : {}),
        ...(data.organizationType !== undefined
          ? { organizationType: data.organizationType }
          : {}),
        ...(data.collaborationType !== undefined
          ? { collaborationType: data.collaborationType }
          : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
        ...(data.mouDocumentUrl !== undefined ? { mouDocumentUrl: data.mouDocumentUrl } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      })
      .where(eq(collaborators.id, id))
      .returning();

    if (Array.isArray(data.projectIds)) {
      await db
        .delete(projectCollaborators)
        .where(eq(projectCollaborators.collaboratorId, id));
      for (const pid of data.projectIds) {
        await db
          .insert(projectCollaborators)
          .values({
            projectId: pid,
            collaboratorId: id,
            role: res[0]?.collaborationType || 'Research Partner',
          })
          .onConflictDoNothing();
      }
    }
    return res[0];
  } catch (error) {
    sanitizeDbError('updateCollaboratorRecord', error);
  }
}

export async function deleteCollaboratorRecord(id: string) {
  try {
    await db.delete(collaborators).where(eq(collaborators.id, id));
  } catch (error) {
    sanitizeDbError('deleteCollaboratorRecord', error);
  }
}

// REPORTS & WORKFLOW
export async function createReportRecord(data: {
  projectId: string;
  scientistId: string;
  title: string;
  reportType: string;
  reportingPeriod: string;
  dueDate: string;
  status?: string;
  fileUrl?: string;
  version?: string;
}) {
  try {
    const isSubmitted = data.status === 'Submitted';
    const res = await db
      .insert(reports)
      .values({
        projectId: data.projectId,
        scientistId: data.scientistId,
        title: data.title.trim(),
        reportType: data.reportType,
        reportingPeriod: data.reportingPeriod.trim(),
        submissionDate: isSubmitted ? new Date().toISOString().slice(0, 10) : null,
        dueDate: data.dueDate,
        status: data.status || 'Draft',
        fileUrl: data.fileUrl || null,
        version: data.version || '1.0',
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createReportRecord', error);
  }
}

export async function updateReportRecord(id: string, data: any) {
  try {
    const existing = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    const isSubmittingNow =
      data.status === 'Submitted' && existing[0]?.status !== 'Submitted';

    const res = await db
      .update(reports)
      .set({
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.reportType !== undefined ? { reportType: data.reportType } : {}),
        ...(data.reportingPeriod !== undefined
          ? { reportingPeriod: data.reportingPeriod }
          : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(isSubmittingNow
          ? { submissionDate: new Date().toISOString().slice(0, 10) }
          : {}),
        ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
        ...(data.version !== undefined ? { version: data.version } : {}),
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();
    return { oldRecord: existing[0], newRecord: res[0] };
  } catch (error) {
    sanitizeDbError('updateReportRecord', error);
  }
}

export async function reviewReportRecord(
  id: string,
  reviewerId: string,
  status: 'Under Review' | 'Approved' | 'Rejected',
  reviewComments?: string
) {
  try {
    const existing = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    const res = await db
      .update(reports)
      .set({
        status,
        reviewerId,
        reviewComments: reviewComments || null,
        approvalDate:
          status === 'Approved' ? new Date().toISOString().slice(0, 10) : null,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();
    return { oldRecord: existing[0], newRecord: res[0] };
  } catch (error) {
    sanitizeDbError('reviewReportRecord', error);
  }
}

// RESEARCH OUTPUTS & PUBLICATIONS STUDIO
export async function createOutputRecord(data: {
  title: string;
  outputType: string;
  projectId?: string | null;
  leadScientistId?: string | null;
  journalOrEvent?: string;
  doi?: string;
  url?: string;
  publicationDate: string;
  abstract?: string;
  manuscriptBody?: string;
  keywords?: string;
  fileUrl?: string;
  status?: string;
  authorUserIds?: string[];
}) {
  try {
    const res = await db
      .insert(researchOutputs)
      .values({
        title: data.title.trim(),
        outputType: data.outputType,
        projectId: data.projectId || null,
        leadScientistId: data.leadScientistId || null,
        journalOrEvent: data.journalOrEvent || null,
        doi: data.doi || null,
        url: data.url || null,
        publicationDate: data.publicationDate,
        abstract: data.abstract || null,
        manuscriptBody: data.manuscriptBody || null,
        keywords: data.keywords || null,
        fileUrl: data.fileUrl || null,
        status: data.status || 'Published',
      })
      .returning();

    const output = res[0];
    const authors = data.authorUserIds && data.authorUserIds.length > 0
      ? data.authorUserIds
      : data.leadScientistId
        ? [data.leadScientistId]
        : [];

    for (let i = 0; i < authors.length; i++) {
      await db
        .insert(outputAuthors)
        .values({
          outputId: output.id,
          userId: authors[i],
          authorOrder: i + 1,
        })
        .onConflictDoNothing();
    }

    return output;
  } catch (error) {
    sanitizeDbError('createOutputRecord', error);
  }
}

export async function updateOutputRecord(id: string, data: any) {
  try {
    const res = await db
      .update(researchOutputs)
      .set({
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.outputType !== undefined ? { outputType: data.outputType } : {}),
        ...(data.projectId !== undefined ? { projectId: data.projectId || null } : {}),
        ...(data.leadScientistId !== undefined
          ? { leadScientistId: data.leadScientistId || null }
          : {}),
        ...(data.journalOrEvent !== undefined
          ? { journalOrEvent: data.journalOrEvent }
          : {}),
        ...(data.doi !== undefined ? { doi: data.doi } : {}),
        ...(data.url !== undefined ? { url: data.url } : {}),
        ...(data.publicationDate !== undefined
          ? { publicationDate: data.publicationDate }
          : {}),
        ...(data.abstract !== undefined ? { abstract: data.abstract } : {}),
        ...(data.manuscriptBody !== undefined
          ? { manuscriptBody: data.manuscriptBody }
          : {}),
        ...(data.keywords !== undefined ? { keywords: data.keywords } : {}),
        ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      })
      .where(eq(researchOutputs.id, id))
      .returning();

    if (Array.isArray(data.authorUserIds)) {
      await db.delete(outputAuthors).where(eq(outputAuthors.outputId, id));
      for (let i = 0; i < data.authorUserIds.length; i++) {
        await db
          .insert(outputAuthors)
          .values({
            outputId: id,
            userId: data.authorUserIds[i],
            authorOrder: i + 1,
          })
          .onConflictDoNothing();
      }
    }

    return res[0];
  } catch (error) {
    sanitizeDbError('updateOutputRecord', error);
  }
}

export async function deleteOutputRecord(id: string) {
  try {
    await db.delete(researchOutputs).where(eq(researchOutputs.id, id));
  } catch (error) {
    sanitizeDbError('deleteOutputRecord', error);
  }
}

// DOCUMENTS & SHARED FILES / IMAGES (WITH SHAREPOINT & WORD COLLABORATION)
export async function createDocumentRecord(data: {
  projectId?: string | null;
  folderId?: string | null;
  uploadedBy: string;
  name: string;
  type: string;
  mimeType?: string;
  description?: string;
  contentBody?: string | null;
  sharepointStatus?: string;
  checkedOutBy?: string | null;
  lastEditedBy?: string | null;
  fileUrl: string;
  fileSize?: string;
  version?: string;
}) {
  try {
    const res = await db
      .insert(documents)
      .values({
        projectId: data.projectId || null,
        folderId: data.folderId || null,
        uploadedBy: data.uploadedBy,
        name: data.name.trim(),
        type: data.type,
        mimeType: data.mimeType || 'application/octet-stream',
        description: data.description || null,
        contentBody: data.contentBody || null,
        sharepointStatus: data.sharepointStatus || 'Published',
        checkedOutBy: data.checkedOutBy || null,
        lastEditedBy: data.lastEditedBy || data.uploadedBy,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize || '120 KB',
        version: data.version || '1.0',
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createDocumentRecord', error);
  }
}

export async function updateDocumentRecord(
  id: string,
  data: {
    name?: string;
    type?: string;
    description?: string | null;
    contentBody?: string | null;
    sharepointStatus?: string;
    checkedOutBy?: string | null;
    lastEditedBy?: string | null;
    fileUrl?: string;
    fileSize?: string;
    version?: string;
    folderId?: string | null;
    projectId?: string | null;
  }
) {
  try {
    const res = await db
      .update(documents)
      .set({
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.contentBody !== undefined ? { contentBody: data.contentBody } : {}),
        ...(data.sharepointStatus !== undefined
          ? { sharepointStatus: data.sharepointStatus }
          : {}),
        ...(data.checkedOutBy !== undefined
          ? { checkedOutBy: data.checkedOutBy || null }
          : {}),
        ...(data.lastEditedBy !== undefined
          ? { lastEditedBy: data.lastEditedBy || null }
          : {}),
        ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
        ...(data.fileSize !== undefined ? { fileSize: data.fileSize } : {}),
        ...(data.version !== undefined ? { version: data.version } : {}),
        ...(data.folderId !== undefined ? { folderId: data.folderId || null } : {}),
        ...(data.projectId !== undefined ? { projectId: data.projectId || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('updateDocumentRecord', error);
  }
}

export async function createSharedFolderRecord(data: {
  name: string;
  description?: string;
  category?: string;
  parentFolderId?: string | null;
  projectId?: string | null;
  createdBy: string;
}) {
  try {
    const res = await db
      .insert(sharedFolders)
      .values({
        name: data.name.trim(),
        description: data.description?.trim() || null,
        category: data.category || 'Research Workspace',
        parentFolderId: data.parentFolderId || null,
        projectId: data.projectId || null,
        createdBy: data.createdBy,
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createSharedFolderRecord', error);
  }
}

export async function deleteSharedFolderRecord(id: string) {
  try {
    await db
      .update(documents)
      .set({ folderId: null })
      .where(eq(documents.folderId, id));
    await db.delete(sharedFolders).where(eq(sharedFolders.id, id));
  } catch (error) {
    sanitizeDbError('deleteSharedFolderRecord', error);
  }
}

export async function createChatMessageRecord(data: {
  channelId: string;
  senderId: string;
  recipientId?: string | null;
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  linkedOutputId?: string | null;
  linkedProjectId?: string | null;
}) {
  try {
    const res = await db
      .insert(chatMessages)
      .values({
        channelId: data.channelId || 'general-research',
        senderId: data.senderId,
        recipientId: data.recipientId || null,
        content: data.content.trim(),
        attachmentUrl: data.attachmentUrl || null,
        attachmentName: data.attachmentName || null,
        attachmentType: data.attachmentType || null,
        linkedOutputId: data.linkedOutputId || null,
        linkedProjectId: data.linkedProjectId || null,
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createChatMessageRecord', error);
  }
}

export async function getChatMessagesRecord() {
  try {
    return await db
      .select()
      .from(chatMessages)
      .orderBy(chatMessages.createdAt)
      .limit(300);
  } catch (error) {
    sanitizeDbError('getChatMessagesRecord', error);
  }
}

export async function deleteDocumentRecord(id: string) {
  try {
    await db.delete(documents).where(eq(documents.id, id));
  } catch (error) {
    sanitizeDbError('deleteDocumentRecord', error);
  }
}

// NOTIFICATIONS
export async function markNotificationReadRecord(id: string, userId: string) {
  try {
    const res = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('markNotificationReadRecord', error);
  }
}

export async function markAllNotificationsReadRecord(userId: string) {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.userId, userId));
  } catch (error) {
    sanitizeDbError('markAllNotificationsReadRecord', error);
  }
}

export async function broadcastAnnouncementRecord(
  title: string,
  message: string,
  type: string = 'Announcement'
) {
  try {
    const allUsers = await db.select().from(users);
    for (const u of allUsers) {
      await db.insert(notifications).values({
        userId: u.id,
        title: title.trim(),
        message: message.trim(),
        type,
      });
    }
    return { recipientCount: allUsers.length };
  } catch (error) {
    sanitizeDbError('broadcastAnnouncementRecord', error);
  }
}

// ADMINISTRATION: DIRECTORATES, RESEARCH AREAS, ROLES, SETTINGS
export async function createDirectorateRecord(data: {
  name: string;
  code: string;
  description?: string;
  headUserId?: string | null;
}) {
  try {
    const res = await db
      .insert(directorates)
      .values({
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        description: data.description || null,
        headUserId: data.headUserId || null,
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createDirectorateRecord', error);
  }
}

export async function updateDirectorateRecord(
  id: string,
  data: {
    name?: string;
    code?: string;
    description?: string;
    headUserId?: string | null;
  }
) {
  try {
    const res = await db
      .update(directorates)
      .set({
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.code !== undefined ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.headUserId !== undefined ? { headUserId: data.headUserId || null } : {}),
      })
      .where(eq(directorates.id, id))
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('updateDirectorateRecord', error);
  }
}

export async function createResearchAreaRecord(data: {
  name: string;
  description?: string;
  directorateId: string;
}) {
  try {
    const res = await db
      .insert(researchAreas)
      .values({
        name: data.name.trim(),
        description: data.description || null,
        directorateId: data.directorateId,
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('createResearchAreaRecord', error);
  }
}

export async function updateRolePermissionsRecord(
  roleId: string,
  permissionIds: string[]
) {
  try {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    for (const pid of permissionIds) {
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId: pid })
        .onConflictDoNothing();
    }
    return { roleId, permissionIds };
  } catch (error) {
    sanitizeDbError('updateRolePermissionsRecord', error);
  }
}

export async function updateSystemSettingsRecord(
  settingKey: string,
  settingValue: Record<string, any>
) {
  try {
    const res = await db
      .insert(systemSettings)
      .values({
        settingKey,
        settingValue,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: {
          settingValue,
          updatedAt: new Date(),
        },
      })
      .returning();
    return res[0];
  } catch (error) {
    sanitizeDbError('updateSystemSettingsRecord', error);
  }
}
