import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { createSessionToken } from './src/lib/password.ts';
import { ensureDbReady, getDbStatus } from './src/db/index.ts';
import {
  ensureSeededFoundation,
  getUserProfile,
  getBootstrapData,
  logAudit,
  createNotificationRecord,
  authenticateEmailPasswordRecord,
  selfResetScientistPasswordRecord,
  changeOwnPasswordRecord,
  createUserRecord,
  updateUserRecord,
  switchUserRoleByName,
  createProjectRecord,
  updateProjectRecord,
  createMilestoneRecord,
  updateMilestoneRecord,
  deleteMilestoneRecord,
  createActivityRecord,
  updateActivityRecord,
  deleteActivityRecord,
  createFunderRecord,
  createFundingRecord,
  updateFundingRecord,
  deleteFundingRecord,
  createLocationRecord,
  updateLocationRecord,
  deleteLocationRecord,
  createCollaboratorRecord,
  updateCollaboratorRecord,
  deleteCollaboratorRecord,
  createReportRecord,
  updateReportRecord,
  reviewReportRecord,
  createOutputRecord,
  updateOutputRecord,
  deleteOutputRecord,
  createDocumentRecord,
  updateDocumentRecord,
  deleteDocumentRecord,
  createSharedFolderRecord,
  deleteSharedFolderRecord,
  createChatMessageRecord,
  getChatMessagesRecord,
  markNotificationReadRecord,
  markAllNotificationsReadRecord,
  broadcastAnnouncementRecord,
  createDirectorateRecord,
  updateDirectorateRecord,
  createResearchAreaRecord,
  updateRolePermissionsRecord,
  updateSystemSettingsRecord,
} from './src/db/repository.ts';
import {
  hasPermission,
  canManageUsers,
  canApproveProject,
  canReviewReport,
  validateUserInput,
  validateProjectInput,
  validateFundingInput,
  validateLocationInput,
  isReportOverdue,
} from './src/lib/domain.ts';
import { generateKmfriAiResponse } from './src/lib/gemini.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS support for Render Static Site Frontend <-> API communication
  app.use((req, res, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '15mb' }));

  // Render & Supabase Health Check Endpoint
  app.get('/api/health', async (_req, res) => {
    await ensureDbReady();
    const dbStatus = getDbStatus();
    res.json({
      status: 'ok',
      service: 'kmfri-research-management-api',
      ...dbStatus,
      timestamp: new Date().toISOString(),
    });
  });

  // Public Email & Password Sign-In Endpoint (for Admin-created researcher accounts & initial Super Admin)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, fullName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email address and password are required.' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const userRecord = await authenticateEmailPasswordRecord(
        String(email),
        String(password),
        fullName
      );
      const token = createSessionToken({
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.fullName,
      });

      await logAudit({
        userId: userRecord.id,
        action: 'LOGIN',
        entityType: 'users',
        entityId: userRecord.id,
        newValues: { method: 'email_password', email: userRecord.email },
        ipAddress: req.ip,
      });

      res.json({
        token,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.fullName,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        error: error.message || 'Invalid credentials or account not yet provisioned by Admin.',
      });
    }
  });

  // Public Scientist Self-Service Password Reset Endpoint (on Sign-In Page)
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, verificationIdentifier, newPassword } = req.body;
      if (!email || !verificationIdentifier || !newPassword) {
        return res.status(400).json({
          error:
            'Institutional email, KMFRI Staff Number (or Full Name), and new password are required.',
        });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({
          error: 'New password must be at least 6 characters long.',
        });
      }

      const updatedUser = await selfResetScientistPasswordRecord(
        String(email),
        String(verificationIdentifier),
        String(newPassword)
      );

      await logAudit({
        userId: updatedUser.id,
        action: 'SELF_PASSWORD_RESET',
        entityType: 'users',
        entityId: updatedUser.id,
        newValues: { email: updatedUser.email, status: updatedUser.status },
        ipAddress: req.ip,
      });

      await createNotificationRecord({
        userId: updatedUser.id,
        title: 'Account Password Reset Completed',
        message:
          'Your KMFRI scientist account password was successfully reset via self-service verification.',
        type: 'Account',
      });

      res.json({
        success: true,
        message: 'Password reset successful. You may now sign in with your new password.',
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Unable to reset password. Please check your details.',
      });
    }
  });

  // Middleware to attach synchronized database user & RBAC context after Firebase token verification
  const attachDbUser = async (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const profile = await getUserProfile(
        req.user.uid,
        req.user.email || `${req.user.uid}@kmfri.go.ke`,
        req.user.name,
        req.user.picture
      );
      if (profile.status === 'Inactive' || profile.status === 'Suspended') {
        return res.status(403).json({
          error:
            'Your KMFRI researcher account is currently deactivated. Please contact an Institutional Administrator.',
        });
      }
      (req as any).profile = profile;
      next();
    } catch (error: any) {
      console.error('Failed to resolve user profile:', error);
      res.status(500).json({ error: error.message || 'Failed to resolve user profile' });
    }
  };

  // 1. Current Authenticated Profile & Bootstrap
  app.get('/api/me', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load user profile' });
    }
  });

  app.get('/api/bootstrap', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const data = await getBootstrapData(profile.id);
      res.json({
        currentUser: profile,
        ...data,
      });
    } catch (error: any) {
      console.error('Failed to load bootstrap data:', error);
      res.status(500).json({ error: error.message || 'Failed to load institutional data' });
    }
  });

  // Allow switching active RBAC role for testing/oversight
  app.post('/api/me/role-switch', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const { roleName } = req.body;
      const updated = await switchUserRoleByName(profile.id, roleName);
      await logAudit({
        userId: profile.id,
        action: 'UPDATE',
        entityType: 'user_role_context',
        entityId: profile.id,
        oldValues: { roleName: profile.roleName },
        newValues: { roleName },
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to switch role' });
    }
  });

  // 2. Users / Scientists CRUD
  app.post('/api/users', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (!canManageUsers(profile.roleName, profile.permissions)) {
        return res.status(403).json({ error: 'Insufficient permissions to create researcher accounts.' });
      }
      const validation = validateUserInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join(' ') });
      }
      const created = await createUserRecord(req.body);
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'users',
        entityId: created.id,
        newValues: {
          fullName: created.fullName,
          email: created.email,
          staffNumber: created.staffNumber,
          position: created.position,
        },
        ipAddress: req.ip,
      });
      await createNotificationRecord({
        userId: created.id,
        title: 'KMFRI Researcher Account Provisioned',
        message: `Welcome ${created.fullName} (${created.staffNumber}). Your KMFRI research portal profile is active.`,
        type: 'Account',
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create scientist account' });
    }
  });

  app.put('/api/users/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const targetId = req.params.id;
      const isSelf = profile.id === targetId;
      if (!isSelf && !canManageUsers(profile.roleName, profile.permissions)) {
        return res.status(403).json({ error: 'Insufficient permissions to modify this account.' });
      }
      const { oldRecord, newRecord } = await updateUserRecord(targetId, req.body);
      await logAudit({
        userId: profile.id,
        action: 'UPDATE',
        entityType: 'users',
        entityId: targetId,
        oldValues: oldRecord,
        newValues: newRecord,
        ipAddress: req.ip,
      });
      res.json(newRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update researcher account' });
    }
  });

  app.patch('/api/users/:id/status', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (!canManageUsers(profile.roleName, profile.permissions)) {
        return res.status(403).json({ error: 'Only Administrators can change account status or reset credentials.' });
      }
      const { status, actionLabel } = req.body;
      const { oldRecord, newRecord } = await updateUserRecord(req.params.id, { status });
      await logAudit({
        userId: profile.id,
        action: actionLabel || 'ACCOUNT_STATUS_CHANGE',
        entityType: 'users',
        entityId: req.params.id,
        oldValues: { status: oldRecord?.status },
        newValues: { status: newRecord?.status },
        ipAddress: req.ip,
      });
      await createNotificationRecord({
        userId: req.params.id,
        title: `Account Status Updated: ${status}`,
        message: `An administrator (${profile.fullName}) updated your account status to ${status}.`,
        type: 'Account',
      });
      res.json(newRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update account status' });
    }
  });

  // 3. Projects CRUD & Approvals
  app.post('/api/projects', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Viewers have read-only access.' });
      }
      const validation = validateProjectInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join(' ') });
      }
      const created = await createProjectRecord(req.body, profile.id);
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'projects',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      if (created.principalInvestigatorId) {
        await createNotificationRecord({
          userId: created.principalInvestigatorId,
          title: `Assigned as PI: ${created.projectCode}`,
          message: `You have been designated Principal Investigator for project "${created.title}".`,
          type: 'Assignment',
        });
      }
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create project' });
    }
  });

  app.put('/api/projects/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Viewers have read-only access.' });
      }
      const { oldRecord, newRecord } = await updateProjectRecord(req.params.id, req.body);
      await logAudit({
        userId: profile.id,
        action: 'UPDATE',
        entityType: 'projects',
        entityId: req.params.id,
        oldValues: oldRecord,
        newValues: newRecord,
        ipAddress: req.ip,
      });
      res.json(newRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update project' });
    }
  });

  app.patch('/api/projects/:id/status', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const { status } = req.body;
      if (
        (status === 'Approved' || status === 'Suspended' || status === 'Cancelled') &&
        !canApproveProject(profile.roleName, profile.permissions)
      ) {
        return res.status(403).json({
          error: 'Only Directors, Directorate Heads, or Administrators can approve or suspend projects.',
        });
      }
      const { oldRecord, newRecord } = await updateProjectRecord(req.params.id, { status });
      await logAudit({
        userId: profile.id,
        action: status === 'Approved' ? 'APPROVE' : 'STATUS_CHANGE',
        entityType: 'projects',
        entityId: req.params.id,
        oldValues: { status: oldRecord?.status },
        newValues: { status: newRecord?.status },
        ipAddress: req.ip,
      });
      if (newRecord?.principalInvestigatorId) {
        await createNotificationRecord({
          userId: newRecord.principalInvestigatorId,
          title: `Project ${newRecord.projectCode} Status: ${status}`,
          message: `Project "${newRecord.title}" status was updated to ${status} by ${profile.fullName}.`,
          type: 'Approval',
        });
      }
      res.json(newRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update project status' });
    }
  });

  // 4. Milestones & Activities
  app.post('/api/milestones', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const created = await createMilestoneRecord(req.body);
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'project_milestones',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create milestone' });
    }
  });

  app.put('/api/milestones/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const updated = await updateMilestoneRecord(req.params.id, req.body);
      await logAudit({
        userId: profile.id,
        action: 'UPDATE',
        entityType: 'project_milestones',
        entityId: req.params.id,
        newValues: updated,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update milestone' });
    }
  });

  app.delete('/api/milestones/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      await deleteMilestoneRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete milestone' });
    }
  });

  app.post('/api/activities', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const created = await createActivityRecord({
        ...req.body,
        scientistId: req.body.scientistId || profile.id,
      });
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'research_activities',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to log research activity' });
    }
  });

  app.put('/api/activities/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const updated = await updateActivityRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update activity' });
    }
  });

  app.delete('/api/activities/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      await deleteActivityRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete activity' });
    }
  });

  // 5. Funders & Funding
  app.post('/api/funders', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (!hasPermission(profile.roleName, profile.permissions, 'manage_funding') && profile.roleName !== 'SCIENTIST/RESEARCHER') {
        return res.status(403).json({ error: 'Insufficient permissions to register funders.' });
      }
      const created = await createFunderRecord(req.body);
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'funders',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create funder' });
    }
  });

  app.post('/api/funding', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const validation = validateFundingInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join(' ') });
      }
      const created = await createFundingRecord(req.body);
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'funding',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to record grant funding' });
    }
  });

  app.put('/api/funding/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const updated = await updateFundingRecord(req.params.id, req.body);
      await logAudit({
        userId: profile.id,
        action: 'UPDATE',
        entityType: 'funding',
        entityId: req.params.id,
        newValues: updated,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update funding record' });
    }
  });

  app.delete('/api/funding/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (!hasPermission(profile.roleName, profile.permissions, 'manage_funding')) {
        return res.status(403).json({ error: 'Insufficient permissions to delete funding.' });
      }
      await deleteFundingRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete funding record' });
    }
  });

  // 6. Locations (GIS)
  app.post('/api/locations', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const validation = validateLocationInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join(' ') });
      }
      const created = await createLocationRecord(req.body);
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'locations',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create GIS location' });
    }
  });

  app.put('/api/locations/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const updated = await updateLocationRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update GIS location' });
    }
  });

  app.delete('/api/locations/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      await deleteLocationRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete location' });
    }
  });

  // 7. Collaborators
  app.post('/api/collaborators', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const created = await createCollaboratorRecord(req.body);
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'collaborators',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to register collaborator' });
    }
  });

  app.put('/api/collaborators/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const updated = await updateCollaboratorRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update collaborator' });
    }
  });

  app.delete('/api/collaborators/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      await deleteCollaboratorRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete collaborator' });
    }
  });

  // 8. Reports & Workflow (Draft -> Submit -> Under Review -> Approve/Reject)
  app.post('/api/reports', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const created = await createReportRecord({
        ...req.body,
        scientistId: req.body.scientistId || profile.id,
      });
      await logAudit({
        userId: profile.id,
        action: created.status === 'Submitted' ? 'SUBMIT' : 'CREATE',
        entityType: 'reports',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create report' });
    }
  });

  app.put('/api/reports/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const { oldRecord, newRecord } = await updateReportRecord(req.params.id, req.body);
      await logAudit({
        userId: profile.id,
        action: newRecord?.status === 'Submitted' ? 'SUBMIT' : 'UPDATE',
        entityType: 'reports',
        entityId: req.params.id,
        oldValues: oldRecord,
        newValues: newRecord,
        ipAddress: req.ip,
      });
      res.json(newRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update report' });
    }
  });

  app.patch('/api/reports/:id/review', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (!canReviewReport(profile.roleName, profile.permissions)) {
        return res.status(403).json({
          error: 'Only Directors, Directorate Heads, or Administrators are authorized to review and approve reports.',
        });
      }
      const { status, reviewComments } = req.body;
      const { oldRecord, newRecord } = await reviewReportRecord(
        req.params.id,
        profile.id,
        status,
        reviewComments
      );
      await logAudit({
        userId: profile.id,
        action: status === 'Approved' ? 'APPROVE' : status === 'Rejected' ? 'REJECT' : 'REVIEW',
        entityType: 'reports',
        entityId: req.params.id,
        oldValues: { status: oldRecord?.status },
        newValues: { status: newRecord?.status, reviewComments },
        ipAddress: req.ip,
      });
      if (newRecord?.scientistId) {
        await createNotificationRecord({
          userId: newRecord.scientistId,
          title: `Report ${status}: ${newRecord.title}`,
          message: `Your report "${newRecord.title}" was marked ${status} by ${profile.fullName}.${
            reviewComments ? ` Reviewer comments: "${reviewComments}"` : ''
          }`,
          type: 'Review',
        });
      }
      res.json(newRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to review report' });
    }
  });

  // 9. Research Outputs
  app.post('/api/outputs', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const created = await createOutputRecord({
        ...req.body,
        leadScientistId: req.body.leadScientistId || profile.id,
      });
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'research_outputs',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to record research output' });
    }
  });

  app.put('/api/outputs/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const updated = await updateOutputRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update research output' });
    }
  });

  app.delete('/api/outputs/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      await deleteOutputRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete research output' });
    }
  });

  // 10. Documents (SharePoint Library & Word Online Co-Authoring)
  app.post('/api/documents', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const created = await createDocumentRecord({
        ...req.body,
        uploadedBy: profile.id,
        lastEditedBy: profile.id,
      });
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'documents',
        entityId: created.id,
        newValues: { name: created.name, type: created.type, version: created.version },
        ipAddress: req.ip,
      });
      broadcastWsEvent({
        type: 'doc:created',
        payload: created,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to upload document' });
    }
  });

  app.put('/api/documents/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      const updated = await updateDocumentRecord(req.params.id, {
        ...req.body,
        lastEditedBy: profile.id,
      });
      await logAudit({
        userId: profile.id,
        action: 'UPDATE',
        entityType: 'documents',
        entityId: req.params.id,
        newValues: {
          name: updated?.name,
          version: updated?.version,
          sharepointStatus: updated?.sharepointStatus,
        },
        ipAddress: req.ip,
      });
      broadcastWsEvent({
        type: 'doc:updated',
        payload: {
          ...updated,
          editorName: profile.fullName,
        },
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update document' });
    }
  });

  app.delete('/api/documents/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      await deleteDocumentRecord(req.params.id);
      broadcastWsEvent({
        type: 'doc:deleted',
        payload: { id: req.params.id },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete document' });
    }
  });

  // 11. Notifications
  app.patch('/api/notifications/:id/read', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const updated = await markNotificationReadRecord(req.params.id, profile.id);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to mark notification read' });
    }
  });

  app.post('/api/notifications/read-all', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      await markAllNotificationsReadRecord(profile.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to mark notifications read' });
    }
  });

  app.post('/api/notifications/broadcast', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (
        profile.roleName !== 'SUPER ADMIN' &&
        profile.roleName !== 'ADMIN' &&
        profile.roleName !== 'DIRECTOR/OVERALL MANAGEMENT' &&
        profile.roleName !== 'HEAD OF OCEANS & COASTAL SYSTEMS'
      ) {
        return res.status(403).json({ error: 'Unauthorized to broadcast institutional announcements.' });
      }
      const { title, message, type } = req.body;
      const result = await broadcastAnnouncementRecord(title, message, type || 'Announcement');
      await logAudit({
        userId: profile.id,
        action: 'BROADCAST',
        entityType: 'notifications',
        newValues: { title, message, recipientCount: result.recipientCount },
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to broadcast announcement' });
    }
  });

  // 12. Administration: Directorates, Research Areas, Roles, System Settings
  app.post('/api/directorates', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (!canManageUsers(profile.roleName, profile.permissions)) {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      const created = await createDirectorateRecord(req.body);
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'directorates',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create directorate' });
    }
  });

  app.put('/api/directorates/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (!canManageUsers(profile.roleName, profile.permissions)) {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      const updated = await updateDirectorateRecord(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update directorate' });
    }
  });

  app.post('/api/research-areas', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (!canManageUsers(profile.roleName, profile.permissions)) {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      const created = await createResearchAreaRecord(req.body);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create research area' });
    }
  });

  app.put('/api/roles/:id/permissions', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName !== 'SUPER ADMIN' && profile.roleName !== 'ADMIN') {
        return res.status(403).json({ error: 'Only Super Admin or Admin can modify role permissions.' });
      }
      const result = await updateRolePermissionsRecord(req.params.id, req.body.permissionIds || []);
      await logAudit({
        userId: profile.id,
        action: 'UPDATE',
        entityType: 'role_permissions',
        entityId: req.params.id,
        newValues: result,
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update role permissions' });
    }
  });

  app.put('/api/settings', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName !== 'SUPER ADMIN' && profile.roleName !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      const { settingKey, settingValue } = req.body;
      const updated = await updateSystemSettingsRecord(settingKey, settingValue);
      await logAudit({
        userId: profile.id,
        action: 'UPDATE',
        entityType: 'system_settings',
        entityId: updated.id,
        newValues: { settingKey, settingValue },
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update system settings' });
    }
  });

  // 13. Authenticated Scientist Self-Service Password Change
  app.post('/api/me/reset-password', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const { newPassword } = req.body;
      if (!newPassword || String(newPassword).trim().length < 6) {
        return res.status(400).json({
          error: 'New password must be at least 6 characters long.',
        });
      }
      const updated = await changeOwnPasswordRecord(profile.id, String(newPassword));
      await logAudit({
        userId: profile.id,
        action: 'PASSWORD_CHANGE',
        entityType: 'users',
        entityId: profile.id,
        newValues: { changedAt: new Date().toISOString() },
        ipAddress: req.ip,
      });
      await createNotificationRecord({
        userId: profile.id,
        title: 'Security Alert: Password Updated',
        message: 'Your KMFRI researcher account password was updated from your workspace.',
        type: 'Account',
      });
      res.json({ success: true, user: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update password' });
    }
  });

  // 13B. Authenticated Scientist Profile Picture Update (persisted to PostgreSQL & broadcast to Chat)
  app.patch('/api/me/profile-photo', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const { profilePhoto, targetUserId } = req.body;
      const effectiveUserId =
        targetUserId && canManageUsers(profile.roleName, profile.permissions)
          ? String(targetUserId)
          : profile.id;

      const { oldRecord, newRecord } = await updateUserRecord(effectiveUserId, {
        profilePhoto: profilePhoto || null,
      });

      await logAudit({
        userId: profile.id,
        action: 'UPDATE_PROFILE_PHOTO',
        entityType: 'users',
        entityId: effectiveUserId,
        oldValues: { hadPhoto: Boolean(oldRecord?.profilePhoto) },
        newValues: { hasPhoto: Boolean(newRecord?.profilePhoto) },
        ipAddress: req.ip,
      });

      // Update any active WebSocket session for this scientist so chat shows the new avatar immediately
      for (const [wsClient, info] of onlineClients.entries()) {
        if (info.userId === effectiveUserId) {
          onlineClients.set(wsClient, {
            ...info,
            profilePhoto: newRecord?.profilePhoto || null,
          });
        }
      }
      broadcastWsEvent({
        type: 'presence:update',
        payload: getUniqueOnlinePresence(),
      });

      res.json({ success: true, user: newRecord });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Failed to update scientist profile photo',
      });
    }
  });

  // 13C. Server-Side KMFRI Gemini AI Research Assistant Endpoint
  app.post('/api/ai/assistant', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const { prompt, taskMode, history } = req.body;
      if (!prompt || !String(prompt).trim()) {
        return res.status(400).json({ error: 'Please enter a scientific prompt or question.' });
      }

      const bootstrap = await getBootstrapData(profile.id);
      const overdueReportsCount = (bootstrap?.reports || []).filter((r) =>
        isReportOverdue(r.dueDate, r.status)
      ).length;

      const reply = await generateKmfriAiResponse({
        prompt: String(prompt),
        taskMode: taskMode ? String(taskMode) : 'General Research Inquiry',
        history: Array.isArray(history) ? history : [],
        contextSummary: {
          scientistName: profile.fullName,
          scientistRole: profile.roleName || 'SCIENTIST/RESEARCHER',
          directorate: profile.directorateName || 'Oceans and Coastal Systems',
          totalProjects: (bootstrap?.projects || []).length,
          activeProjects: (bootstrap?.projects || []).slice(0, 6).map((p) => ({
            code: p.projectCode,
            title: p.title,
            status: p.status,
            progress: p.progressPercent,
          })),
          totalPublications: (bootstrap?.researchOutputs || []).length,
          recentPublications: (bootstrap?.researchOutputs || []).slice(0, 5).map((o) => ({
            title: o.title,
            type: o.outputType,
            status: o.status,
          })),
          totalLocations: (bootstrap?.locations || []).length,
          overdueReportsCount,
        },
      });

      await logAudit({
        userId: profile.id,
        action: 'AI_ASSISTANT_QUERY',
        entityType: 'ai_assistant',
        entityId: profile.id,
        newValues: { taskMode: taskMode || 'General', promptPreview: String(prompt).slice(0, 120) },
        ipAddress: req.ip,
      });

      res.json({ reply, model: 'gemini-3.8-flash', timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('Gemini AI Assistant error:', error);
      res.status(500).json({
        error:
          error.message ||
          'Unable to process your request with the KMFRI AI Research Assistant.',
      });
    }
  });

  // 14. Shared Folders (Platform-Wide File, Folder & Image Sharing)
  app.post('/api/folders', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      if (!req.body.name || !String(req.body.name).trim()) {
        return res.status(400).json({ error: 'Folder name is required.' });
      }
      const created = await createSharedFolderRecord({
        ...req.body,
        createdBy: profile.id,
      });
      await logAudit({
        userId: profile.id,
        action: 'CREATE',
        entityType: 'shared_folders',
        entityId: created.id,
        newValues: created,
        ipAddress: req.ip,
      });
      broadcastWsEvent({
        type: 'folder:created',
        payload: created,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create shared folder' });
    }
  });

  app.delete('/api/folders/:id', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      if (profile.roleName === 'VIEWER') {
        return res.status(403).json({ error: 'Read-only access.' });
      }
      await deleteSharedFolderRecord(req.params.id);
      broadcastWsEvent({
        type: 'folder:deleted',
        payload: { id: req.params.id },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete shared folder' });
    }
  });

  // 15. Real-Time Scientist Chat & Online Presence Endpoints
  const onlineClients = new Map<
    WebSocket,
    {
      userId: string;
      fullName: string;
      staffNumber: string | null;
      roleName: string;
      directorateCode: string | null;
      profilePhoto: string | null;
      connectedAt: string;
    }
  >();

  function getUniqueOnlinePresence() {
    const byUserId = new Map<string, any>();
    for (const info of onlineClients.values()) {
      if (info?.userId) {
        byUserId.set(info.userId, info);
      }
    }
    return Array.from(byUserId.values());
  }

  function broadcastWsEvent(event: { type: string; payload: any }) {
    const raw = JSON.stringify(event);
    for (const client of onlineClients.keys()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  app.get('/api/chat/presence', requireAuth, attachDbUser, (_req, res) => {
    res.json({ onlineUsers: getUniqueOnlinePresence() });
  });

  app.get('/api/chat/messages', requireAuth, attachDbUser, async (_req, res) => {
    try {
      const messages = await getChatMessagesRecord();
      res.json({ messages, onlineUsers: getUniqueOnlinePresence() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load chat messages' });
    }
  });

  app.post('/api/chat/messages', requireAuth, attachDbUser, async (req: AuthRequest, res) => {
    try {
      const profile = (req as any).profile;
      const {
        channelId,
        recipientId,
        content,
        attachmentUrl,
        attachmentName,
        attachmentType,
        linkedOutputId,
        linkedProjectId,
      } = req.body;

      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: 'Message content cannot be empty.' });
      }

      const created = await createChatMessageRecord({
        channelId: channelId || 'general-research',
        senderId: profile.id,
        recipientId: recipientId || null,
        content: String(content),
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        attachmentType: attachmentType || null,
        linkedOutputId: linkedOutputId || null,
        linkedProjectId: linkedProjectId || null,
      });

      broadcastWsEvent({
        type: 'chat:message',
        payload: created,
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to send chat message' });
    }
  });

  // Create HTTP Server & Attach Real-Time WebSocket Server on /ws/chat
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/chat' });

  wss.on('connection', (ws) => {
    onlineClients.set(ws, {
      userId: '',
      fullName: 'Connecting...',
      staffNumber: null,
      roleName: 'SCIENTIST/RESEARCHER',
      directorateCode: 'OCS',
      profilePhoto: null,
      connectedAt: new Date().toISOString(),
    });

    ws.on('message', async (rawBuffer) => {
      try {
        const msg = JSON.parse(rawBuffer.toString());
        if (msg.type === 'presence:join' && msg.payload?.userId) {
          onlineClients.set(ws, {
            userId: String(msg.payload.userId),
            fullName: String(msg.payload.fullName || 'KMFRI Scientist'),
            staffNumber: msg.payload.staffNumber || null,
            roleName: String(msg.payload.roleName || 'SCIENTIST/RESEARCHER'),
            directorateCode: msg.payload.directorateCode || 'OCS',
            profilePhoto: msg.payload.profilePhoto || null,
            connectedAt: new Date().toISOString(),
          });
          broadcastWsEvent({
            type: 'presence:update',
            payload: getUniqueOnlinePresence(),
          });
        } else if (msg.type === 'chat:send' && msg.payload?.senderId && msg.payload?.content) {
          const saved = await createChatMessageRecord({
            channelId: msg.payload.channelId || 'general-research',
            senderId: msg.payload.senderId,
            recipientId: msg.payload.recipientId || null,
            content: String(msg.payload.content),
            attachmentUrl: msg.payload.attachmentUrl || null,
            attachmentName: msg.payload.attachmentName || null,
            attachmentType: msg.payload.attachmentType || null,
            linkedOutputId: msg.payload.linkedOutputId || null,
            linkedProjectId: msg.payload.linkedProjectId || null,
          });
          broadcastWsEvent({
            type: 'chat:message',
            payload: saved,
          });
        } else if (msg.type === 'doc:coauthor_ping' && msg.payload?.docId) {
          broadcastWsEvent({
            type: 'doc:coauthor_ping',
            payload: msg.payload,
          });
        }
      } catch (err) {
        console.error('WebSocket message handling error:', err);
      }
    });

    ws.on('close', () => {
      onlineClients.delete(ws);
      broadcastWsEvent({
        type: 'presence:update',
        payload: getUniqueOnlinePresence(),
      });
    });
  });

  // Bind port 3000 immediately so health probes succeed without waiting for Vite compilation
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`KMFRI Research Management Server & WebSocket Hub running on http://localhost:${PORT}`);
    ensureSeededFoundation().catch((err) => {
      console.warn('Initial DB warm-up warning:', err?.message || err);
    });
  });

  // Frontend middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();
