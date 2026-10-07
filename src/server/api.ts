import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  loadDatabase,
  saveDatabase,
  loadCredentials,
  saveCredentials,
  hashPassword,
  verifyPassword,
  generateStrongPassword,
  resolveInitialAdminPassword,
  appendAuditLog,
  appendNotification,
  userHasPermission,
  dispatchInstitutionalEmail,
  performDailyAuditMaintenance,
} from './db.ts';
import {
  checkSupabaseConnection,
  flushSupabaseMirror,
  getSupabaseMirrorStatus,
  mirrorSnapshotToSupabase,
} from './supabase.ts';
import {
  broadcastNewChatMessage,
  broadcastRealtimeEvent,
  getOnlineUserIds,
} from './realtime.ts';
import {
  ChatMessage,
  PermissionCode,
  ProjectPriority,
  ProjectStatus,
  ReportStatus,
  RoleCode,
  SharedFolder,
  UserProfile,
} from '../types/kmfri.ts';

export const apiRouter = express.Router();

// =============================================================================
// SESSION TOKENS
// -----------------------------------------------------------------------------
// Tokens are stateless and HMAC-signed so they survive restarts and horizontal
// scaling. SESSION_SECRET must be set in production; without it a random secret
// is generated at boot, which means every restart invalidates existing sessions.
// =============================================================================

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS) > 0
  ? Number(process.env.SESSION_TTL_HOURS) * 60 * 60 * 1000
  : 12 * 60 * 60 * 1000;

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[auth] SESSION_SECRET is not set. A random secret was generated, so all sessions will be invalidated on restart. Set SESSION_SECRET in production.'
  );
}

function signSessionPayload(payload: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function issueSessionToken(userId: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${signSessionPayload(payload)}`;
}

function readSessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresAtRaw, signature] = parts;
  const payload = `${userId}.${expiresAtRaw}`;

  const expected = Buffer.from(signSessionPayload(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return userId;
}

interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

function getAuthenticatedUser(req: Request): UserProfile | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const userId = readSessionToken(token);
  if (!userId) return null;
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === userId);
  if (!user || !user.is_active) return null;
  return user;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Valid session required.' });
    return;
  }
  req.user = user;
  next();
}

function requirePermission(permission: PermissionCode) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const db = loadDatabase();
    if (!userHasPermission(db, user, permission)) {
      appendAuditLog(db, {
        actor: user,
        action: 'UNAUTHORIZED_ACCESS_BLOCKED',
        entity_type: 'security',
        entity_id: null,
        summary: `Blocked attempt by ${user.email} (${user.role_code}) requiring permission ${permission}`,
        metadata: { path: req.path, method: req.method, requiredPermission: permission },
      });
      saveDatabase(db);
      res.status(403).json({
        error: `Forbidden: Your role (${user.role_code}) lacks required permission '${permission}'.`,
      });
      return;
    }
    next();
  };
}

// =============================================================================
// 1. AUTHENTICATION & PASSWORD RESET ROUTES
// =============================================================================

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = loadDatabase();
  const creds = loadCredentials();

  let user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  let cred = creds.find((c) => c.email.toLowerCase() === normalizedEmail);

  // If user is accessing as admin/super admin, allow standard admin passwords
  const rawPassword = String(password);
  const passwordCheck = verifyPassword(rawPassword, cred?.password_hash || '');
  const passwordValid = passwordCheck.valid;

  if (!user || !cred || !passwordValid) {
    appendAuditLog(db, {
      actor: null,
      action: 'AUTH_LOGIN_FAILED',
      entity_type: 'auth',
      entity_id: user?.id ?? null,
      summary: `Failed email/password login attempt for ${normalizedEmail}`,
    });
    saveDatabase(db);
    res.status(401).json({ error: 'Invalid institutional email or password.' });
    return;
  }

  // Transparently upgrade legacy salted-SHA256 credential hashes after a successful sign-in
  if (passwordCheck.needsRehash && cred) {
    cred.password_hash = hashPassword(rawPassword);
    saveCredentials(creds);
  }

  if (!user.is_active) {
    appendAuditLog(db, {
      actor: user,
      action: 'AUTH_LOGIN_DEACTIVATED',
      entity_type: 'auth',
      entity_id: user.id,
      summary: `Blocked login for deactivated account ${user.email}`,
    });
    saveDatabase(db);
    res.status(403).json({ error: 'Your account has been deactivated by an administrator.' });
    return;
  }

  user.last_login_at = new Date().toISOString();
  user.updated_at = user.last_login_at;

  const token = issueSessionToken(user.id);

  appendAuditLog(db, {
    actor: user,
    action: 'AUTH_LOGIN_SUCCESS',
    entity_type: 'auth',
    entity_id: user.id,
    summary: `${user.full_name} (${user.role_code}) signed in via email/password`,
  });

  // Automated Sign-In Security Email Alert to Scientist
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Web Browser';
  const loginTime = new Date().toUTCString();

  dispatchInstitutionalEmail(db, {
    recipient_email: user.email,
    recipient_name: `${user.title || ''} ${user.full_name}`.trim(),
    subject: '🛡️ KMFRI Security Alert: Successful Sign-In to Scientist Portal',
    type: 'LOGIN_ALERT',
    body_text: `Dear ${user.full_name},\n\nYour KMFRI Scientist Portal account was accessed successfully.\nTime: ${loginTime}\nStaff Number: ${user.staff_number}\nStation: ${user.office_station || 'Mombasa Headquarters'}\nDevice: ${userAgent}\nIP Address: ${clientIp}\n\nIf you did not perform this login, please immediately change your password or contact the ICT Security Desk at sysadmin@kmfri.go.ke.`,
    body_html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0A2540; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">KENYA MARINE AND FISHERIES RESEARCH INSTITUTE</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #38bdf8;">Ministry of Mining, Blue Economy and Maritime Affairs</p>
        </div>
        <div style="padding: 24px; color: #1e293b;">
          <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; margin-bottom: 16px;">
            ● Institutional Security Alert
          </div>
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0f172a;">Successful Portal Sign-In Notification</h3>
          <p style="font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
            Dear <strong>${user.title || ''} ${user.full_name}</strong>,<br/>
            This automated email confirms that your official KMFRI account was successfully accessed on the KMFRI Scientists &amp; Research Portfolio Management Portal.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; font-family: monospace; line-height: 1.8; color: #334155; margin-bottom: 20px;">
            <div><strong>Staff Number:</strong> ${user.staff_number}</div>
            <div><strong>Role / Position:</strong> ${user.role_code} &mdash; ${user.position}</div>
            <div><strong>Research Station:</strong> ${user.office_station || 'Mombasa Headquarters'}</div>
            <div><strong>Timestamp:</strong> ${loginTime}</div>
            <div><strong>Device / Browser:</strong> ${userAgent}</div>
            <div><strong>Access IP:</strong> ${clientIp}</div>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
            If you authorized this sign-in, no further action is needed. If you did NOT initiate this session, please contact the KMFRI ICT Security Desk at <a href="mailto:sysadmin@kmfri.go.ke" style="color: #0284c7;">sysadmin@kmfri.go.ke</a> or reset your password immediately in your user profile page.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          KMFRI Headquarters, English Point, Mkomani, P.O. Box 81651 - 80100 Mombasa, Kenya · Portal Security Service
        </div>
      </div>
    `,
    metadata: { clientIp, userAgent, staffNumber: user.staff_number },
  });

  appendNotification(db, {
    recipient_user_id: user.id,
    category: 'Account',
    title: 'Sign-In Alert',
    message: `Account sign-in detected on ${loginTime}. Automated confirmation email dispatched to ${user.email}.`,
    entity_type: 'users',
    entity_id: user.id,
  });

  saveDatabase(db);

  res.json({
    token,
    user,
  });
});

apiRouter.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  // Tokens are stateless and HMAC-signed, so sign-out is a client-side discard.
  const db = loadDatabase();
  if (req.user) {
    appendAuditLog(db, {
      actor: req.user,
      action: 'AUTH_LOGOUT',
      entity_type: 'auth',
      entity_id: req.user.id,
      summary: `${req.user.full_name} signed out`,
    });
    saveDatabase(db);
  }
  res.json({ success: true });
});

apiRouter.get('/auth/session', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'No active session' });
    return;
  }
  res.json({ user });
});

// Password Reset Request & Execution Flow
apiRouter.post('/auth/request-password-reset', (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: 'Email address is required.' });
    return;
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const db = loadDatabase();
  const creds = loadCredentials();
  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  const cred = creds.find((c) => c.email.toLowerCase() === normalizedEmail);

  if (!user || !cred) {
    res.status(404).json({ error: 'No registered KMFRI account found with that email address.' });
    return;
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  cred.reset_token = resetCode;
  cred.reset_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  saveCredentials(creds);

  appendAuditLog(db, {
    actor: user,
    action: 'AUTH_PASSWORD_RESET_REQUESTED',
    entity_type: 'users',
    entity_id: user.id,
    summary: `Password reset verification code issued for ${user.email}`,
  });
  appendNotification(db, {
    recipient_user_id: user.id,
    category: 'Account',
    title: 'Password Reset Requested',
    message: `A password reset verification code (${resetCode}) was generated for your account. Automated email dispatched to ${user.email}.`,
    entity_type: 'users',
    entity_id: user.id,
  });

  // Automated Email Dispatch with Verification Code
  dispatchInstitutionalEmail(db, {
    recipient_email: user.email,
    recipient_name: `${user.title || ''} ${user.full_name}`.trim(),
    subject: '🔑 KMFRI Account Security: Password Reset Verification Code',
    type: 'PASSWORD_RESET_CODE',
    body_text: `Dear ${user.full_name},\n\nA password reset request was initiated for your KMFRI Scientist Portal account.\n\nYour 6-digit one-time verification code is: ${resetCode}\nThis code will expire in 15 minutes.\n\nIf you did not make this request, please contact ICT Security at sysadmin@kmfri.go.ke immediately.`,
    body_html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0A2540; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px;">KENYA MARINE AND FISHERIES RESEARCH INSTITUTE</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #38bdf8;">Institutional Account Security Service</p>
        </div>
        <div style="padding: 24px; color: #1e293b;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0f172a;">Password Reset Verification Code</h3>
          <p style="font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
            Dear <strong>${user.title || ''} ${user.full_name}</strong>,<br/>
            We received a request to reset your password for the KMFRI Scientists &amp; Research Portfolio Management Portal.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 10px; padding: 16px 36px;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #15803d; letter-spacing: 1px;">Your 6-Digit Code</div>
              <div style="font-size: 32px; font-weight: 800; font-family: monospace; letter-spacing: 6px; color: #0f172a; margin-top: 4px;">${resetCode}</div>
            </div>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
            This verification code is strictly confidential and valid for <strong>15 minutes</strong>. If you did not initiate this password reset, please ignore this email or contact the KMFRI System Administrator.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          KMFRI Headquarters · P.O. Box 81651 - 80100 Mombasa, Kenya
        </div>
      </div>
    `,
    metadata: { verification_code: resetCode },
  });

  saveDatabase(db);

  res.json({
    message: 'Password reset verification code generated.',
    verification_code: resetCode,
  });
});

apiRouter.post('/auth/confirm-password-reset', (req: Request, res: Response) => {
  const { email, verification_code, new_password } = req.body ?? {};
  if (!email || !verification_code || !new_password || String(new_password).length < 6) {
    res.status(400).json({ error: 'Email, valid verification code, and new password (min 6 chars) are required.' });
    return;
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const db = loadDatabase();
  const creds = loadCredentials();
  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  const cred = creds.find((c) => c.email.toLowerCase() === normalizedEmail);

  if (!user || !cred || cred.reset_token !== String(verification_code).trim()) {
    res.status(400).json({ error: 'Invalid or expired verification code.' });
    return;
  }

  cred.password_hash = hashPassword(String(new_password));
  cred.reset_token = null;
  cred.reset_expires_at = null;
  saveCredentials(creds);

  user.password_reset_required = false;
  user.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: user,
    action: 'AUTH_PASSWORD_RESET_COMPLETED',
    entity_type: 'users',
    entity_id: user.id,
    summary: `Password reset completed for ${user.email}`,
  });

  // Automated Confirmation Email Dispatch
  dispatchInstitutionalEmail(db, {
    recipient_email: user.email,
    recipient_name: `${user.title || ''} ${user.full_name}`.trim(),
    subject: '✅ KMFRI Account Security: Password Reset Successfully Completed',
    type: 'PASSWORD_RESET_CONFIRMATION',
    body_text: `Dear ${user.full_name},\n\nYour KMFRI portal password was successfully updated on ${new Date().toUTCString()}.\nYou may now sign into your account with your new password.\n\nIf you did not perform this change, please contact the KMFRI ICT Security Desk at sysadmin@kmfri.go.ke immediately.`,
    body_html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0A2540; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px;">KENYA MARINE AND FISHERIES RESEARCH INSTITUTE</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #38bdf8;">Institutional Account Security Service</p>
        </div>
        <div style="padding: 24px; color: #1e293b;">
          <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; margin-bottom: 16px;">
            ● Password Update Confirmed
          </div>
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0f172a;">Password Changed Successfully</h3>
          <p style="font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
            Dear <strong>${user.title || ''} ${user.full_name}</strong>,<br/>
            This is an automated confirmation that your password for the KMFRI Scientists &amp; Research Portfolio Management Portal was successfully reset on <strong>${new Date().toUTCString()}</strong>.
          </p>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
            You can now sign in using your updated password. If you did NOT authorize this password modification, please alert our security desk immediately at <a href="mailto:sysadmin@kmfri.go.ke" style="color: #0284c7;">sysadmin@kmfri.go.ke</a>.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          KMFRI Headquarters, English Point, Mkomani, P.O. Box 81651 - 80100 Mombasa, Kenya
        </div>
      </div>
    `,
  });

  appendNotification(db, {
    recipient_user_id: user.id,
    category: 'Account',
    title: 'Password Changed',
    message: 'Your account password was updated. Confirmation email sent to your registered address.',
    entity_type: 'users',
    entity_id: user.id,
  });

  saveDatabase(db);

  res.json({ success: true, message: 'Password updated successfully. You may now sign in.' });
});

// Provision or sign in to a system role account for RBAC verification.
// SECURITY: this endpoint previously granted a SUPER_ADMIN session to any unauthenticated
// caller. It is now restricted to signed-in super administrators and disabled by default.
apiRouter.post('/auth/quick-role-access', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (process.env.KMFRI_ALLOW_ROLE_SWITCH !== 'true') {
    res.status(403).json({
      error: 'Role switching is disabled. Set KMFRI_ALLOW_ROLE_SWITCH=true to enable RBAC verification.',
    });
    return;
  }
  if (req.user?.role_code !== RoleCode.SUPER_ADMIN) {
    res.status(403).json({ error: 'Only a SUPER_ADMIN may switch the active role session.' });
    return;
  }
  const { role_code } = req.body ?? {};
  const db = loadDatabase();
  const creds = loadCredentials();
  const role = db.roles.find((r) => r.code === role_code);
  if (!role) {
    res.status(400).json({ error: 'Invalid RBAC role specified.' });
    return;
  }

  const roleConfigs: Record<RoleCode, { email: string; staff: string; name: string; title: string; pos: string; dir: string | null; area: string | null; isOp: boolean }> = {
    [RoleCode.SUPER_ADMIN]: {
      email: 'sysadmin@kmfri.go.ke',
      staff: 'SYS-BOOTSTRAP-01',
      name: 'KMFRI System Administrator',
      title: 'Sys.',
      pos: 'Chief Information & Governance Administrator',
      dir: null,
      area: null,
      isOp: false,
    },
    [RoleCode.ADMIN]: {
      email: 'role.admin@kmfri.go.ke',
      staff: 'SYS-ROLE-ADMIN',
      name: 'Institutional Admin Role Session',
      title: 'Mr.',
      pos: 'Senior Research Registry Administrator',
      dir: null,
      area: null,
      isOp: false,
    },
    [RoleCode.DIRECTOR]: {
      email: 'director@kmfri.go.ke',
      staff: 'SYS-DIR-01',
      name: 'Director General Office',
      title: 'Prof.',
      pos: 'Director General / Overall Management',
      dir: null,
      area: null,
      isOp: false,
    },
    [RoleCode.HEAD_OCS]: {
      email: 'head.ocs@kmfri.go.ke',
      staff: 'KMFRI-OCS-HEAD',
      name: 'Head of Oceans & Coastal Systems',
      title: 'Dr.',
      pos: 'Directorate Head — Oceans & Coastal Systems',
      dir: '30000000-0000-4000-8000-000000000001',
      area: '40000000-0000-4000-8000-000000000001',
      isOp: false,
    },
    [RoleCode.SCIENTIST]: {
      email: 'researcher@kmfri.go.ke',
      staff: 'KMFRI-RES-PORTAL',
      name: 'Principal Research Scientist Account',
      title: 'Dr.',
      pos: 'Principal Research Scientist',
      dir: '30000000-0000-4000-8000-000000000001',
      area: '40000000-0000-4000-8000-000000000002',
      isOp: false,
    },
    [RoleCode.VIEWER]: {
      email: 'viewer@kmfri.go.ke',
      staff: 'SYS-VIEWER-01',
      name: 'Ministry & Stakeholder Observer',
      title: 'Ms.',
      pos: 'External Policy & Stakeholder Auditor',
      dir: null,
      area: null,
      isOp: false,
    },
  };

  const cfg = roleConfigs[role.code];
  let user = db.users.find((u) => u.email.toLowerCase() === cfg.email.toLowerCase());
  const now = new Date().toISOString();

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      staff_number: cfg.staff,
      email: cfg.email,
      full_name: cfg.name,
      title: cfg.title,
      position: cfg.pos,
      role_id: role.id,
      role_code: role.code,
      directorate_id: cfg.dir,
      research_area_id: cfg.area,
      phone: '+254 20 8021560',
      office_station: 'Mombasa Headquarters (English Point)',
      is_active: true,
      is_operational_scientist: cfg.isOp,
      last_login_at: now,
      password_reset_required: false,
      created_at: now,
      updated_at: now,
    };
    db.users.push(user);
    creds.push({
      user_id: user.id,
      email: user.email,
      password_hash: hashPassword(resolveInitialAdminPassword()),
    });
    saveCredentials(creds);
  } else {
    user.last_login_at = now;
  }

  const token = issueSessionToken(user.id);

  appendAuditLog(db, {
    actor: user,
    action: 'AUTH_ROLE_SESSION_INIT',
    entity_type: 'auth',
    entity_id: user.id,
    summary: `Authenticated session initialized for role ${role.name} (${user.email})`,
  });
  saveDatabase(db);

  res.json({ token, user });
});

// =============================================================================
// 2. SNAPSHOT & SQL MIGRATION INSPECTION
// =============================================================================

// Unauthenticated liveness probe for Render / load balancers
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'kmfri-research-management',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/snapshot', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  res.json(db);
});

apiRouter.get('/sql-artifacts', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const schemaPath = path.resolve(process.cwd(), 'supabase/migrations/0001_kmfri_schema.sql');
    const seedPath = path.resolve(process.cwd(), 'supabase/seed.sql');
    const schemaSql = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf-8') : '';
    const seedSql = fs.existsSync(seedPath) ? fs.readFileSync(seedPath, 'utf-8') : '';
    res.json({ schemaSql, seedSql });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to read SQL files' });
  }
});

// Supabase / PostgreSQL mirror: configuration, reachability, and manual sync
apiRouter.get('/supabase/status', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  const status = getSupabaseMirrorStatus();
  const connection = status.configured ? await checkSupabaseConnection() : {
    reachable: false,
    message: 'Supabase credentials are not configured.',
    latencyMs: null,
  };
  res.json({ ...status, connection });
});

apiRouter.post(
  '/supabase/sync',
  requireAuth,
  requirePermission(PermissionCode.SETTINGS_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const status = getSupabaseMirrorStatus();
    if (!status.enabled) {
      res.status(400).json({
        error: 'Supabase mirroring is disabled. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      });
      return;
    }
    const db = loadDatabase();
    // An explicit sync honours the prune flag so administrators can reconcile deletions.
    const result = await mirrorSnapshotToSupabase(db, { prune: req.body?.prune === true });
    res.json(result);
  }
);

// Daily Audit Trail Maintenance & Synchronization Endpoints
apiRouter.get('/audit/daily-status', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const setting = db.system_settings.find((s) => s.setting_key === 'audit_daily_lifecycle');
  const today = new Date().toISOString().split('T')[0];
  const lastRefreshDate = (setting?.setting_value?.last_refresh_date as string) || today;
  const lastRefreshedAt = (setting?.setting_value?.last_refreshed_at as string) || new Date().toISOString();
  
  const todayCount = db.audit_logs.filter((a) => a.created_at.startsWith(today)).length;

  res.json({
    active: true,
    today,
    lastRefreshDate,
    lastRefreshedAt,
    isRefreshedToday: lastRefreshDate === today,
    todayEventCount: todayCount,
    totalEventCount: db.audit_logs.length,
    retentionCycle: '24-hour Daily Rollover Active',
  });
});

apiRouter.post('/audit/refresh-daily', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const result = performDailyAuditMaintenance(db, true);
  broadcastRealtimeEvent('db:updated', { entity: 'audit_logs', action: 'daily_refresh' });
  res.json({
    success: true,
    ...result,
    totalEvents: db.audit_logs.length,
  });
});

// Periodic background check for daily audit rollover (runs every 15 minutes)
setInterval(() => {
  try {
    const db = loadDatabase();
    const result = performDailyAuditMaintenance(db, false);
    if (result.refreshed) {
      broadcastRealtimeEvent('db:updated', { entity: 'audit_logs', action: 'daily_rollover' });
    }
  } catch {
    // Background audit refresh silent error handling
  }
}, 15 * 60 * 1000);

// =============================================================================
// 3. SCIENTISTS & USER MANAGEMENT (ADMIN / RBAC ENFORCED)
// =============================================================================

apiRouter.post('/users', requireAuth, requirePermission(PermissionCode.USERS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const creds = loadCredentials();
  const body = req.body ?? {};

  const staffNumber = String(body.staff_number ?? '').trim().toUpperCase();
  const email = String(body.email ?? '').trim().toLowerCase();
  const fullName = String(body.full_name ?? '').trim();
  const initialPassword = String(body.password ?? '');

  if (!staffNumber || !email || !fullName || initialPassword.length < 8) {
    res.status(400).json({ error: 'Staff number, email, full name, and an initial password of at least 8 characters are required.' });
    return;
  }

  if (db.users.some((u) => u.staff_number.toUpperCase() === staffNumber)) {
    res.status(409).json({ error: `Duplicate staff number: '${staffNumber}' is already registered.` });
    return;
  }
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    res.status(409).json({ error: `Duplicate email: '${email}' is already registered.` });
    return;
  }

  const roleCode: RoleCode = body.role_code || RoleCode.SCIENTIST;
  const role = db.roles.find((r) => r.code === roleCode) || db.roles.find((r) => r.code === RoleCode.SCIENTIST)!;
  const now = new Date().toISOString();

  const newUser: UserProfile = {
    id: crypto.randomUUID(),
    staff_number: staffNumber,
    email,
    full_name: fullName,
    title: String(body.title || 'Dr.'),
    position: String(body.position || 'Research Scientist'),
    role_id: role.id,
    role_code: role.code,
    directorate_id: body.directorate_id || null,
    research_area_id: body.research_area_id || null,
    phone: String(body.phone || ''),
    office_station: String(body.office_station || 'Mombasa Headquarters'),
    orcid_id: body.orcid_id ? String(body.orcid_id) : undefined,
    specialization: body.specialization ? String(body.specialization) : undefined,
    bio: body.bio ? String(body.bio) : undefined,
    avatar_url: body.avatar_url ? String(body.avatar_url) : undefined,
    is_active: true,
    is_operational_scientist: body.is_operational_scientist !== undefined ? Boolean(body.is_operational_scientist) : true,
    last_login_at: null,
    password_reset_required: false,
    created_at: now,
    updated_at: now,
  };

  db.users.unshift(newUser);
  creds.push({
    user_id: newUser.id,
    email: newUser.email,
    password_hash: hashPassword(initialPassword),
  });
  saveCredentials(creds);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'USER_ACCOUNT_CREATED',
    entity_type: 'users',
    entity_id: newUser.id,
    summary: `Created scientist/user account for ${newUser.title} ${newUser.full_name} (${newUser.staff_number}) with role ${newUser.role_code}`,
    metadata: { staff_number: newUser.staff_number, email: newUser.email, role: newUser.role_code },
  });

  appendNotification(db, {
    recipient_user_id: newUser.id,
    category: 'Account',
    title: 'Welcome to KMFRI Research Management System',
    message: `Your researcher profile (${newUser.staff_number}) has been provisioned under ${newUser.office_station}.`,
    entity_type: 'users',
    entity_id: newUser.id,
  });

  saveDatabase(db);
  res.status(201).json(newUser);
});

apiRouter.put('/users/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Scientist / user record not found.' });
    return;
  }

  const canManageUsers = userHasPermission(db, req.user!, PermissionCode.USERS_MANAGE);
  const isSelf = req.user!.id === target.id;
  if (!canManageUsers && !isSelf) {
    res.status(403).json({ error: 'Forbidden: Only administrators or the profile owner can update this profile.' });
    return;
  }

  const body = req.body ?? {};
  if (body.staff_number) {
    const normalizedStaff = String(body.staff_number).trim().toUpperCase();
    if (db.users.some((u) => u.id !== target.id && u.staff_number.toUpperCase() === normalizedStaff)) {
      res.status(409).json({ error: `Duplicate staff number '${normalizedStaff}'.` });
      return;
    }
    target.staff_number = normalizedStaff;
  }
  if (body.email) {
    const normalizedEmail = String(body.email).trim().toLowerCase();
    if (db.users.some((u) => u.id !== target.id && u.email.toLowerCase() === normalizedEmail)) {
      res.status(409).json({ error: `Duplicate email '${normalizedEmail}'.` });
      return;
    }
    target.email = normalizedEmail;
  }

  if (body.full_name !== undefined) target.full_name = String(body.full_name).trim();
  if (body.title !== undefined) target.title = String(body.title);
  if (body.position !== undefined) target.position = String(body.position);
  if (body.directorate_id !== undefined) target.directorate_id = body.directorate_id || null;
  if (body.research_area_id !== undefined) target.research_area_id = body.research_area_id || null;
  if (body.phone !== undefined) target.phone = String(body.phone);
  if (body.office_station !== undefined) target.office_station = String(body.office_station);
  if (body.orcid_id !== undefined) target.orcid_id = String(body.orcid_id);
  if (body.specialization !== undefined) target.specialization = String(body.specialization);
  if (body.bio !== undefined) target.bio = String(body.bio);
  if (body.avatar_url !== undefined) {
    target.avatar_url = body.avatar_url ? String(body.avatar_url) : undefined;
    // Sync avatar across user's chat messages
    db.chat_messages.forEach((m) => {
      if (m.sender_id === target.id) {
        m.sender_avatar = target.avatar_url;
      }
    });
  }

  if (canManageUsers && body.role_code) {
    const newRole = db.roles.find((r) => r.code === body.role_code);
    if (newRole) {
      target.role_id = newRole.id;
      target.role_code = newRole.code;
    }
  }

  target.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: 'USER_PROFILE_UPDATED',
    entity_type: 'users',
    entity_id: target.id,
    summary: `Updated profile for ${target.full_name} (${target.staff_number})`,
    metadata: { updated_fields: Object.keys(body) },
  });

  // Automated Profile Update Email Alert
  dispatchInstitutionalEmail(db, {
    recipient_email: target.email,
    recipient_name: `${target.title || ''} ${target.full_name}`.trim(),
    subject: 'ℹ️ KMFRI Account: Scientist Profile Updated',
    type: 'PROFILE_UPDATED',
    body_text: `Dear ${target.full_name},\n\nYour KMFRI scientist profile information was updated on ${new Date().toUTCString()}.\nUpdated attributes: ${Object.keys(body).join(', ')}.\n\nIf you did not make these modifications, please contact the KMFRI System Administrator.`,
    body_html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0A2540; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px;">KENYA MARINE AND FISHERIES RESEARCH INSTITUTE</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #38bdf8;">Scientist Profile Management</p>
        </div>
        <div style="padding: 24px; color: #1e293b;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0f172a;">Profile Information Updated</h3>
          <p style="font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
            Dear <strong>${target.title || ''} ${target.full_name}</strong>,<br/>
            Your scientist profile attributes were successfully saved on <strong>${new Date().toUTCString()}</strong>.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; color: #334155; margin-bottom: 16px;">
            <div><strong>Staff Number:</strong> ${target.staff_number}</div>
            <div><strong>Email:</strong> ${target.email}</div>
            <div><strong>Phone Contact:</strong> ${target.phone || 'N/A'}</div>
            <div><strong>Designation:</strong> ${target.position}</div>
            <div><strong>Station:</strong> ${target.office_station}</div>
          </div>
        </div>
      </div>
    `,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'users', id: target.id });
  res.json(target);
});

// Dedicated Scientist Profile Picture Upload / Update
apiRouter.post('/users/:id/avatar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Scientist / user record not found.' });
    return;
  }

  const canManageUsers = userHasPermission(db, req.user!, PermissionCode.USERS_MANAGE);
  const isSelf = req.user!.id === target.id;
  if (!canManageUsers && !isSelf) {
    res.status(403).json({ error: 'Forbidden: You can only update your own profile picture.' });
    return;
  }

  const { avatar_url } = req.body ?? {};
  target.avatar_url = avatar_url ? String(avatar_url) : undefined;
  target.updated_at = new Date().toISOString();

  db.chat_messages.forEach((m) => {
    if (m.sender_id === target.id) {
      m.sender_avatar = target.avatar_url;
    }
  });

  appendAuditLog(db, {
    actor: req.user!,
    action: 'USER_AVATAR_UPDATED',
    entity_type: 'users',
    entity_id: target.id,
    summary: `Updated profile picture for ${target.title} ${target.full_name} (${target.staff_number})`,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'users', id: target.id });
  res.json(target);
});

// Self-Service Password Change / Reset for Logged-In Scientists & Users
apiRouter.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { current_password, new_password } = req.body ?? {};
  if (!new_password || String(new_password).length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }

  const db = loadDatabase();
  const creds = loadCredentials();
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }

  let cred = creds.find((c) => c.user_id === user.id || c.email.toLowerCase() === user.email.toLowerCase());
  if (current_password && (!cred || !verifyPassword(String(current_password), cred.password_hash).valid)) {
    res.status(400).json({ error: 'Current password provided is incorrect.' });
    return;
  }

  if (!cred) {
    cred = {
      user_id: user.id,
      email: user.email,
      password_hash: hashPassword(String(new_password)),
    };
    creds.push(cred);
  } else {
    cred.password_hash = hashPassword(String(new_password));
  }
  saveCredentials(creds);

  user.password_reset_required = false;
  user.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: user,
    action: 'USER_SELF_PASSWORD_CHANGED',
    entity_type: 'users',
    entity_id: user.id,
    summary: `${user.title} ${user.full_name} (${user.email}) updated their account password`,
  });

  // Automated Password Changed Email Dispatch
  const emailDispatch = await dispatchInstitutionalEmail(db, {
    recipient_email: user.email,
    recipient_name: `${user.title || ''} ${user.full_name}`.trim(),
    subject: '✅ KMFRI Account Security: Your Password Was Successfully Updated',
    type: 'PASSWORD_CHANGED',
    body_text: `Dear ${user.full_name},\n\nYour account password on the KMFRI Scientists & Research Portfolio Management Portal was successfully changed on ${new Date().toUTCString()} from your User Profile page.\n\nIf you did not perform this change, please contact the KMFRI ICT Security Desk at sysadmin@kmfri.go.ke immediately.`,
    body_html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0A2540; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px;">KENYA MARINE AND FISHERIES RESEARCH INSTITUTE</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #38bdf8;">Institutional Account Security Service</p>
        </div>
        <div style="padding: 24px; color: #1e293b;">
          <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; margin-bottom: 16px;">
            ● Password Update Confirmed
          </div>
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0f172a;">Password Updated Successfully</h3>
          <p style="font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
            Dear <strong>${user.title || ''} ${user.full_name}</strong>,<br/>
            This automated email confirms that your KMFRI portal password was changed on <strong>${new Date().toUTCString()}</strong> from your profile page.
          </p>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 16px;">
            If you made this change, you may safely disregard this notification. If you did NOT make this change, please immediately alert the KMFRI ICT Security Desk at <a href="mailto:sysadmin@kmfri.go.ke" style="color: #0284c7;">sysadmin@kmfri.go.ke</a>.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          KMFRI Headquarters, English Point, Mkomani, P.O. Box 81651 - 80100 Mombasa, Kenya
        </div>
      </div>
    `,
  });

  appendNotification(db, {
    recipient_user_id: user.id,
    category: 'Account',
    title: 'Password Updated Successfully',
    message: 'Your KMFRI account password was changed. An automated confirmation email has been dispatched to your email address.',
    entity_type: 'users',
    entity_id: user.id,
  });

  saveDatabase(db);
  const emailMessage = emailDispatch.status === 'SENT'
    ? 'A confirmation email was sent to your registered address.'
    : emailDispatch.status === 'FAILED'
      ? 'The password changed, but SMTP could not deliver the confirmation email.'
      : 'The password changed, but SMTP is not configured, so no email was sent.';
  res.json({ success: true, message: `Your password has been updated. ${emailMessage}` });
});

// Get User's Automated Email Dispatches (Mailbox / Security Log)
apiRouter.get('/emails/my-dispatches', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const user = req.user!;
  const isAdmin = user.role_code === RoleCode.SUPER_ADMIN || user.role_code === RoleCode.ADMIN;
  const emails = (db.email_dispatches || []).filter(
    (e) => isAdmin || e.recipient_email.toLowerCase() === user.email.toLowerCase()
  );
  res.json({ emails });
});

apiRouter.post('/users/:id/toggle-status', requireAuth, requirePermission(PermissionCode.USERS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (target.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot deactivate your own active administrator account.' });
    return;
  }

  target.is_active = !target.is_active;
  target.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: target.is_active ? 'USER_ACCOUNT_REACTIVATED' : 'USER_ACCOUNT_DEACTIVATED',
    entity_type: 'users',
    entity_id: target.id,
    summary: `${target.is_active ? 'Reactivated' : 'Deactivated'} account for ${target.full_name} (${target.email})`,
  });

  appendNotification(db, {
    recipient_user_id: target.id,
    category: 'Account',
    title: target.is_active ? 'Account Reactivated' : 'Account Deactivated',
    message: `Your KMFRI researcher account status was changed to ${target.is_active ? 'Active' : 'Deactivated'} by ${req.user!.full_name}.`,
    entity_type: 'users',
    entity_id: target.id,
  });

  saveDatabase(db);
  res.json(target);
});

apiRouter.post('/users/:id/reset-password', requireAuth, requirePermission(PermissionCode.USERS_RESET_PASSWORD), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const creds = loadCredentials();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const newPassword = String(req.body?.new_password || 'KmfriReset@2026');
  let cred = creds.find((c) => c.user_id === target.id || c.email.toLowerCase() === target.email.toLowerCase());
  if (!cred) {
    cred = {
      user_id: target.id,
      email: target.email,
      password_hash: hashPassword(newPassword),
    };
    creds.push(cred);
  } else {
    cred.password_hash = hashPassword(newPassword);
  }
  saveCredentials(creds);

  target.password_reset_required = true;
  target.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: 'ADMIN_USER_PASSWORD_RESET',
    entity_type: 'users',
    entity_id: target.id,
    summary: `Administrator ${req.user!.email} reset password for ${target.full_name} (${target.email})`,
  });

  appendNotification(db, {
    recipient_user_id: target.id,
    category: 'Account',
    title: 'Administrative Password Reset',
    message: `An administrator reset your account password. Please update your password upon next sign-in.`,
    entity_type: 'users',
    entity_id: target.id,
  });

  saveDatabase(db);
  res.json({ success: true, temporary_password: newPassword });
});

// Admin Delete User Account
apiRouter.delete('/users/:id', requireAuth, requirePermission(PermissionCode.USERS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (target.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own administrator account.' });
    return;
  }
  if (target.role_code === RoleCode.SUPER_ADMIN) {
    res.status(400).json({ error: 'Cannot delete Super Admin accounts.' });
    return;
  }

  // Remove user from all associated data
  db.users = db.users.filter((u) => u.id !== target.id);
  db.project_members = db.project_members.filter((pm) => pm.user_id !== target.id);
  db.project_milestones = db.project_milestones.filter((m) => m.owner_id !== target.id);
  db.research_activities = db.research_activities.filter((a) => a.scientist_id !== target.id);
  db.reports = db.reports.filter((r) => r.scientist_id !== target.id);
  db.output_authors = db.output_authors.filter((oa) => oa.user_id !== target.id);
  db.chat_messages = db.chat_messages.filter((m) => m.sender_id !== target.id);
  db.notifications = db.notifications.filter((n) => n.recipient_user_id !== target.id);
  db.audit_logs = db.audit_logs.filter((al) => al.actor_user_id !== target.id);

  // Remove credentials
  const creds = loadCredentials();
  saveCredentials(creds.filter((c) => c.user_id !== target.id));

  appendAuditLog(db, {
    actor: req.user!,
    action: 'USER_ACCOUNT_DELETED',
    entity_type: 'users',
    entity_id: target.id,
    summary: `Administrator ${req.user!.email} permanently deleted account for ${target.full_name} (${target.email}, ${target.staff_number})`,
    metadata: { deleted_staff_number: target.staff_number, deleted_email: target.email, deleted_role: target.role_code },
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'users', action: 'deleted', id: target.id });
  res.json({ success: true, message: `Account for ${target.full_name} (${target.staff_number}) permanently deleted.` });
});

// =============================================================================
// 4. PROJECTS, TEAM MEMBERS, MILESTONES & APPROVALS
// =============================================================================

apiRouter.post('/projects', requireAuth, requirePermission(PermissionCode.PROJECTS_CREATE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  const projectCode = String(body.project_code ?? '').trim().toUpperCase();

  if (!projectCode || !body.title || !body.directorate_id || !body.research_area_id || !body.principal_investigator_id) {
    res.status(400).json({ error: 'Project code, title, directorate, research area, and Principal Investigator are required.' });
    return;
  }

  if (db.projects.some((p) => p.project_code.toUpperCase() === projectCode)) {
    res.status(409).json({ error: `Duplicate project code: '${projectCode}' already exists.` });
    return;
  }

  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    project_code: projectCode,
    title: String(body.title).trim(),
    description: String(body.description || ''),
    objectives: Array.isArray(body.objectives) ? body.objectives : String(body.objectives_text || '').split('\n').map((s: string) => s.trim()).filter(Boolean),
    research_area_id: String(body.research_area_id),
    directorate_id: String(body.directorate_id),
    principal_investigator_id: String(body.principal_investigator_id),
    start_date: String(body.start_date),
    end_date: String(body.end_date),
    status: (body.status as ProjectStatus) || ProjectStatus.PROPOSED,
    priority: (body.priority as ProjectPriority) || ProjectPriority.MEDIUM,
    budget: Number(body.budget || 0),
    currency: body.currency || 'KES',
    primary_funder_id: body.primary_funder_id || null,
    deliverables: Array.isArray(body.deliverables) ? body.deliverables : String(body.deliverables_text || '').split('\n').map((s: string) => s.trim()).filter(Boolean),
    progress_percent: Number(body.progress_percent || 0),
    risks_issues: String(body.risks_issues || ''),
    is_archived: false,
    approved_by: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
  };

  db.projects.unshift(project);

  // Automatically enroll the PI in project_members
  db.project_members.push({
    id: crypto.randomUUID(),
    project_id: project.id,
    user_id: project.principal_investigator_id,
    project_role: 'Principal Investigator',
    allocation_percent: 50,
    assigned_at: now,
  });

  appendAuditLog(db, {
    actor: req.user!,
    action: 'PROJECT_CREATED',
    entity_type: 'projects',
    entity_id: project.id,
    summary: `Created project ${project.project_code}: "${project.title}"`,
    metadata: { project_code: project.project_code, status: project.status, budget: project.budget, currency: project.currency },
  });

  appendNotification(db, {
    recipient_user_id: project.principal_investigator_id,
    category: 'Assignment',
    title: `Assigned as Principal Investigator: ${project.project_code}`,
    message: `You have been designated Principal Investigator for project "${project.title}".`,
    entity_type: 'projects',
    entity_id: project.id,
  });

  saveDatabase(db);
  res.status(201).json(project);
});

apiRouter.put('/projects/:id', requireAuth, requirePermission(PermissionCode.PROJECTS_EDIT), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const project = db.projects.find((p) => p.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const body = req.body ?? {};
  if (body.project_code) {
    const code = String(body.project_code).trim().toUpperCase();
    if (db.projects.some((p) => p.id !== project.id && p.project_code.toUpperCase() === code)) {
      res.status(409).json({ error: `Duplicate project code '${code}'.` });
      return;
    }
    project.project_code = code;
  }

  if (body.title !== undefined) project.title = String(body.title).trim();
  if (body.description !== undefined) project.description = String(body.description);
  if (body.objectives !== undefined) project.objectives = body.objectives;
  if (body.objectives_text !== undefined) {
    project.objectives = String(body.objectives_text).split('\n').map((s: string) => s.trim()).filter(Boolean);
  }
  if (body.research_area_id !== undefined) project.research_area_id = String(body.research_area_id);
  if (body.directorate_id !== undefined) project.directorate_id = String(body.directorate_id);
  if (body.principal_investigator_id !== undefined) project.principal_investigator_id = String(body.principal_investigator_id);
  if (body.start_date !== undefined) project.start_date = String(body.start_date);
  if (body.end_date !== undefined) project.end_date = String(body.end_date);
  if (body.priority !== undefined) project.priority = body.priority;
  if (body.budget !== undefined) project.budget = Number(body.budget);
  if (body.currency !== undefined) project.currency = body.currency;
  if (body.primary_funder_id !== undefined) project.primary_funder_id = body.primary_funder_id || null;
  if (body.deliverables !== undefined) project.deliverables = body.deliverables;
  if (body.deliverables_text !== undefined) {
    project.deliverables = String(body.deliverables_text).split('\n').map((s: string) => s.trim()).filter(Boolean);
  }
  if (body.progress_percent !== undefined) project.progress_percent = Math.min(100, Math.max(0, Number(body.progress_percent)));
  if (body.risks_issues !== undefined) project.risks_issues = String(body.risks_issues);
  if (body.status !== undefined) project.status = body.status;

  project.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: 'PROJECT_UPDATED',
    entity_type: 'projects',
    entity_id: project.id,
    summary: `Updated project ${project.project_code} (Progress: ${project.progress_percent}%, Status: ${project.status})`,
  });

  saveDatabase(db);
  res.json(project);
});

apiRouter.post('/projects/:id/approve', requireAuth, requirePermission(PermissionCode.PROJECTS_APPROVE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const project = db.projects.find((p) => p.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const newStatus: ProjectStatus = req.body?.status || ProjectStatus.APPROVED;
  const previousStatus = project.status;
  project.status = newStatus;
  if (newStatus === ProjectStatus.APPROVED || newStatus === ProjectStatus.IN_PROGRESS) {
    project.approved_by = req.user!.id;
    project.approved_at = new Date().toISOString();
  }
  project.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: 'PROJECT_STATUS_DECISION',
    entity_type: 'projects',
    entity_id: project.id,
    summary: `Changed project ${project.project_code} status from '${previousStatus}' to '${newStatus}'`,
    metadata: { previousStatus, newStatus, comments: req.body?.comments },
  });

  appendNotification(db, {
    recipient_user_id: project.principal_investigator_id,
    category: 'Project Approval',
    title: `Project ${project.project_code} Status: ${newStatus}`,
    message: `Project "${project.title}" was transitioned to '${newStatus}' by ${req.user!.full_name}.`,
    entity_type: 'projects',
    entity_id: project.id,
  });

  saveDatabase(db);
  res.json(project);
});

apiRouter.post('/projects/:id/archive', requireAuth, requirePermission(PermissionCode.PROJECTS_ARCHIVE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const project = db.projects.find((p) => p.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  project.is_archived = !project.is_archived;
  project.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: project.is_archived ? 'PROJECT_ARCHIVED' : 'PROJECT_RESTORED',
    entity_type: 'projects',
    entity_id: project.id,
    summary: `${project.is_archived ? 'Archived' : 'Restored'} project ${project.project_code}`,
  });

  saveDatabase(db);
  res.json(project);
});

apiRouter.post('/projects/:id/members', requireAuth, requirePermission(PermissionCode.PROJECTS_EDIT), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const project = db.projects.find((p) => p.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const { user_id, project_role, allocation_percent } = req.body ?? {};
  if (!user_id) {
    res.status(400).json({ error: 'Scientist user_id is required.' });
    return;
  }
  if (db.project_members.some((pm) => pm.project_id === project.id && pm.user_id === user_id)) {
    res.status(409).json({ error: 'Scientist is already assigned to this project team.' });
    return;
  }

  const member = {
    id: crypto.randomUUID(),
    project_id: project.id,
    user_id: String(user_id),
    project_role: project_role || 'Co-Investigator',
    allocation_percent: Number(allocation_percent || 25),
    assigned_at: new Date().toISOString(),
  };
  db.project_members.push(member);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'PROJECT_MEMBER_ASSIGNED',
    entity_type: 'project_members',
    entity_id: member.id,
    summary: `Assigned researcher to project ${project.project_code} as ${member.project_role}`,
  });

  appendNotification(db, {
    recipient_user_id: member.user_id,
    category: 'Assignment',
    title: `Team Assignment: ${project.project_code}`,
    message: `You were assigned to project "${project.title}" as ${member.project_role}.`,
    entity_type: 'projects',
    entity_id: project.id,
  });

  saveDatabase(db);
  res.status(201).json(member);
});

apiRouter.delete('/projects/:projectId/members/:memberId', requireAuth, requirePermission(PermissionCode.PROJECTS_EDIT), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const idx = db.project_members.findIndex((m) => m.id === req.params.memberId && m.project_id === req.params.projectId);
  if (idx === -1) {
    res.status(404).json({ error: 'Project member not found.' });
    return;
  }
  const removed = db.project_members.splice(idx, 1)[0];
  appendAuditLog(db, {
    actor: req.user!,
    action: 'PROJECT_MEMBER_REMOVED',
    entity_type: 'project_members',
    entity_id: removed.id,
    summary: `Removed team member ${removed.user_id} from project ${removed.project_id}`,
  });
  saveDatabase(db);
  res.json({ success: true });
});

apiRouter.post('/projects/:id/milestones', requireAuth, requirePermission(PermissionCode.PROJECTS_EDIT), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const project = db.projects.find((p) => p.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const body = req.body ?? {};
  if (!body.title || !body.due_date) {
    res.status(400).json({ error: 'Milestone title and due date are required.' });
    return;
  }

  const now = new Date().toISOString();
  const milestone = {
    id: crypto.randomUUID(),
    project_id: project.id,
    title: String(body.title).trim(),
    description: String(body.description || ''),
    due_date: String(body.due_date),
    completed_date: body.status === 'Completed' ? now.split('T')[0] : null,
    status: body.status || 'Pending',
    progress_percent: Number(body.progress_percent || 0),
    owner_id: body.owner_id || req.user!.id,
    deliverable_summary: String(body.deliverable_summary || ''),
    created_at: now,
    updated_at: now,
  };

  db.project_milestones.push(milestone);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'MILESTONE_CREATED',
    entity_type: 'project_milestones',
    entity_id: milestone.id,
    summary: `Added milestone "${milestone.title}" to project ${project.project_code}`,
  });

  if (milestone.owner_id) {
    appendNotification(db, {
      recipient_user_id: milestone.owner_id,
      category: 'Milestone',
      title: `New Milestone Assigned: ${project.project_code}`,
      message: `Milestone "${milestone.title}" is due on ${milestone.due_date}.`,
      entity_type: 'projects',
      entity_id: project.id,
    });
  }

  saveDatabase(db);
  res.status(201).json(milestone);
});

apiRouter.put('/milestones/:id', requireAuth, requirePermission(PermissionCode.PROJECTS_EDIT), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const milestone = db.project_milestones.find((m) => m.id === req.params.id);
  if (!milestone) {
    res.status(404).json({ error: 'Milestone not found.' });
    return;
  }
  const body = req.body ?? {};
  if (body.title !== undefined) milestone.title = String(body.title);
  if (body.description !== undefined) milestone.description = String(body.description);
  if (body.due_date !== undefined) milestone.due_date = String(body.due_date);
  if (body.status !== undefined) {
    milestone.status = body.status;
    if (body.status === 'Completed') {
      milestone.progress_percent = 100;
      milestone.completed_date = new Date().toISOString().split('T')[0];
    }
  }
  if (body.progress_percent !== undefined) milestone.progress_percent = Number(body.progress_percent);
  if (body.deliverable_summary !== undefined) milestone.deliverable_summary = String(body.deliverable_summary);
  milestone.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: 'MILESTONE_UPDATED',
    entity_type: 'project_milestones',
    entity_id: milestone.id,
    summary: `Updated milestone "${milestone.title}" (${milestone.status}, ${milestone.progress_percent}%)`,
  });

  saveDatabase(db);
  res.json(milestone);
});

// =============================================================================
// 5. FUNDERS & FUNDING GRANTS
// =============================================================================

apiRouter.post('/funders', requireAuth, requirePermission(PermissionCode.FUNDING_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  const name = String(body.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'Funder name is required.' });
    return;
  }
  if (db.funders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
    res.status(409).json({ error: `Funder '${name}' already exists.` });
    return;
  }

  const now = new Date().toISOString();
  const funder = {
    id: crypto.randomUUID(),
    name,
    funder_type: body.funder_type || 'Multilateral',
    country: String(body.country || 'Kenya'),
    contact_person: String(body.contact_person || ''),
    contact_email: String(body.contact_email || ''),
    contact_phone: String(body.contact_phone || ''),
    website: body.website ? String(body.website) : undefined,
    created_at: now,
    updated_at: now,
  };

  db.funders.unshift(funder);
  appendAuditLog(db, {
    actor: req.user!,
    action: 'FUNDER_CREATED',
    entity_type: 'funders',
    entity_id: funder.id,
    summary: `Registered funding organization "${funder.name}" (${funder.funder_type})`,
  });
  saveDatabase(db);
  res.status(201).json(funder);
});

apiRouter.post('/funding', requireAuth, requirePermission(PermissionCode.FUNDING_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  const grantNumber = String(body.grant_number ?? '').trim().toUpperCase();

  if (!grantNumber || !body.funder_id || !body.project_id) {
    res.status(400).json({ error: 'Grant number, funder, and project are required.' });
    return;
  }
  if (db.funding.some((g) => g.grant_number.toUpperCase() === grantNumber)) {
    res.status(409).json({ error: `Duplicate grant number: '${grantNumber}' already exists.` });
    return;
  }

  const allocated = Number(body.allocated_amount ?? body.amount ?? 0);
  const spent = Number(body.spent_amount ?? 0);
  const now = new Date().toISOString();

  const grant = {
    id: crypto.randomUUID(),
    grant_number: grantNumber,
    funder_id: String(body.funder_id),
    project_id: String(body.project_id),
    amount: Number(body.amount || 0),
    currency: body.currency || 'KES',
    award_date: String(body.award_date),
    start_date: String(body.start_date),
    end_date: String(body.end_date),
    allocated_amount: allocated,
    spent_amount: spent,
    remaining_amount: allocated - spent,
    status: body.status || 'Active',
    notes: String(body.notes || ''),
    created_at: now,
    updated_at: now,
  };

  db.funding.unshift(grant);

  const project = db.projects.find((p) => p.id === grant.project_id);
  appendAuditLog(db, {
    actor: req.user!,
    action: 'FUNDING_GRANT_CREATED',
    entity_type: 'funding',
    entity_id: grant.id,
    summary: `Recorded grant ${grant.grant_number} (${grant.currency} ${grant.amount.toLocaleString()}) for project ${project?.project_code || grant.project_id}`,
  });

  if (project) {
    appendNotification(db, {
      recipient_user_id: project.principal_investigator_id,
      category: 'Funding',
      title: `Grant Recorded: ${grant.grant_number}`,
      message: `Grant ${grant.grant_number} (${grant.currency} ${grant.amount.toLocaleString()}) has been linked to project "${project.title}".`,
      entity_type: 'funding',
      entity_id: grant.id,
    });
  }

  saveDatabase(db);
  res.status(201).json(grant);
});

apiRouter.put('/funding/:id', requireAuth, requirePermission(PermissionCode.FUNDING_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const grant = db.funding.find((g) => g.id === req.params.id);
  if (!grant) {
    res.status(404).json({ error: 'Funding grant not found.' });
    return;
  }

  const body = req.body ?? {};
  if (body.allocated_amount !== undefined) grant.allocated_amount = Number(body.allocated_amount);
  if (body.spent_amount !== undefined) grant.spent_amount = Number(body.spent_amount);
  if (body.amount !== undefined) grant.amount = Number(body.amount);
  if (body.status !== undefined) grant.status = body.status;
  if (body.notes !== undefined) grant.notes = String(body.notes);
  grant.remaining_amount = grant.allocated_amount - grant.spent_amount;
  grant.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: 'FUNDING_GRANT_UPDATED',
    entity_type: 'funding',
    entity_id: grant.id,
    summary: `Updated financial expenditure for grant ${grant.grant_number} (Spent: ${grant.currency} ${grant.spent_amount.toLocaleString()})`,
  });

  saveDatabase(db);
  res.json(grant);
});

// =============================================================================
// 6. REPORTS & WORKFLOW (DRAFT -> SUBMIT -> UNDER REVIEW -> APPROVE/REJECT)
// =============================================================================

apiRouter.post('/reports', requireAuth, requirePermission(PermissionCode.REPORTS_SUBMIT), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  if (!body.title || !body.project_id || !body.scientist_id || !body.due_date) {
    res.status(400).json({ error: 'Report title, project, scientist, and due date are required.' });
    return;
  }

  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const status: ReportStatus = body.status || ReportStatus.DRAFT;

  const report = {
    id: crypto.randomUUID(),
    title: String(body.title).trim(),
    project_id: String(body.project_id),
    scientist_id: String(body.scientist_id),
    report_type: body.report_type || 'Quarterly Progress',
    reporting_period: String(body.reporting_period || 'Q1 FY 2026/27'),
    due_date: String(body.due_date),
    submission_date: status === ReportStatus.SUBMITTED ? now : null,
    status,
    is_overdue: String(body.due_date) < today && status !== ReportStatus.APPROVED,
    reviewer_id: null,
    reviewer_comments: '',
    approval_date: null,
    version: 1,
    summary: String(body.summary || ''),
    created_at: now,
    updated_at: now,
  };

  db.reports.unshift(report);

  appendAuditLog(db, {
    actor: req.user!,
    action: status === ReportStatus.SUBMITTED ? 'REPORT_SUBMITTED' : 'REPORT_DRAFT_CREATED',
    entity_type: 'reports',
    entity_id: report.id,
    summary: `${status === ReportStatus.SUBMITTED ? 'Submitted' : 'Created draft'} report "${report.title}" (${report.report_type})`,
  });

  if (status === ReportStatus.SUBMITTED) {
    appendNotification(db, {
      recipient_user_id: null,
      category: 'Report Submission',
      title: `Report Submitted for Review: ${report.title}`,
      message: `Report "${report.title}" (${report.reporting_period}) has been submitted for supervisory review.`,
      entity_type: 'reports',
      entity_id: report.id,
    });
  }

  saveDatabase(db);
  res.status(201).json(report);
});

apiRouter.post('/reports/:id/workflow', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const report = db.reports.find((r) => r.id === req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const { action, comments } = req.body ?? {};
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  if (action === 'submit') {
    if (!userHasPermission(db, req.user!, PermissionCode.REPORTS_SUBMIT)) {
      res.status(403).json({ error: 'Forbidden: Missing reports:submit permission.' });
      return;
    }
    if (report.status === ReportStatus.REJECTED) {
      report.version += 1;
    }
    report.status = ReportStatus.SUBMITTED;
    report.submission_date = now;
    report.updated_at = now;

    appendAuditLog(db, {
      actor: req.user!,
      action: 'REPORT_WORKFLOW_SUBMIT',
      entity_type: 'reports',
      entity_id: report.id,
      summary: `Submitted report "${report.title}" (v${report.version}) for review`,
    });

    appendNotification(db, {
      recipient_user_id: null,
      category: 'Report Submission',
      title: `Report Submitted (v${report.version}): ${report.title}`,
      message: `${req.user!.full_name} submitted "${report.title}" for review.`,
      entity_type: 'reports',
      entity_id: report.id,
    });
  } else if (action === 'start_review' || action === 'approve' || action === 'reject') {
    if (!userHasPermission(db, req.user!, PermissionCode.REPORTS_REVIEW)) {
      res.status(403).json({ error: 'Forbidden: Only authorized reviewers/directors can review, approve, or reject reports.' });
      return;
    }

    report.reviewer_id = req.user!.id;
    if (comments !== undefined) {
      report.reviewer_comments = String(comments);
    }

    if (action === 'start_review') {
      report.status = ReportStatus.UNDER_REVIEW;
    } else if (action === 'approve') {
      report.status = ReportStatus.APPROVED;
      report.approval_date = now;
      report.is_overdue = false;
    } else if (action === 'reject') {
      report.status = ReportStatus.REJECTED;
      report.is_overdue = report.due_date < today;
    }
    report.updated_at = now;

    appendAuditLog(db, {
      actor: req.user!,
      action: `REPORT_WORKFLOW_${String(action).toUpperCase()}`,
      entity_type: 'reports',
      entity_id: report.id,
      summary: `Reviewer ${req.user!.full_name} transitioned report "${report.title}" to '${report.status}'`,
      metadata: { comments: report.reviewer_comments, version: report.version },
    });

    appendNotification(db, {
      recipient_user_id: report.scientist_id,
      category: 'Report Review',
      title: `Report ${report.status}: ${report.title}`,
      message: `Your report "${report.title}" was marked '${report.status}' by ${req.user!.full_name}.${report.reviewer_comments ? ` Comments: ${report.reviewer_comments}` : ''}`,
      entity_type: 'reports',
      entity_id: report.id,
    });
  } else {
    res.status(400).json({ error: 'Invalid report workflow action.' });
    return;
  }

  saveDatabase(db);
  res.json(report);
});

// =============================================================================
// 7. GIS LOCATIONS & RESEARCH ACTIVITIES
// =============================================================================

apiRouter.post('/locations', requireAuth, requirePermission(PermissionCode.LOCATIONS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};

  if (!body.site_name || !body.county || body.latitude === undefined || body.longitude === undefined) {
    res.status(400).json({ error: 'Site name, county, latitude, and longitude are required.' });
    return;
  }

  const now = new Date().toISOString();
  const loc = {
    id: crypto.randomUUID(),
    country: String(body.country || 'Kenya'),
    county: String(body.county).trim(),
    sub_county: String(body.sub_county || '').trim(),
    site_name: String(body.site_name).trim(),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    marine_coastal_area: body.marine_coastal_area || 'Inshore Reef',
    description: String(body.description || ''),
    created_at: now,
    updated_at: now,
  };

  db.locations.unshift(loc);

  if (body.project_id) {
    db.project_locations.push({
      id: crypto.randomUUID(),
      project_id: String(body.project_id),
      location_id: loc.id,
      activity_summary: String(body.activity_summary || 'Primary field sampling station'),
      created_at: now,
    });
  }

  appendAuditLog(db, {
    actor: req.user!,
    action: 'GIS_LOCATION_CREATED',
    entity_type: 'locations',
    entity_id: loc.id,
    summary: `Registered GIS sampling station "${loc.site_name}" (${loc.county}, [${loc.latitude}, ${loc.longitude}])`,
  });

  saveDatabase(db);
  res.status(201).json(loc);
});

apiRouter.post('/activities', requireAuth, requirePermission(PermissionCode.PROJECTS_EDIT), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  if (!body.project_id || !body.title || !body.activity_date) {
    res.status(400).json({ error: 'Project, title, and activity date are required.' });
    return;
  }

  const activity = {
    id: crypto.randomUUID(),
    project_id: String(body.project_id),
    scientist_id: String(body.scientist_id || req.user!.id),
    location_id: body.location_id || null,
    activity_type: body.activity_type || 'Field Sampling',
    title: String(body.title).trim(),
    description: String(body.description || ''),
    activity_date: String(body.activity_date),
    status: body.status || 'Completed',
    observations: body.observations || {},
    created_at: new Date().toISOString(),
  };

  db.research_activities.unshift(activity);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'RESEARCH_ACTIVITY_LOGGED',
    entity_type: 'research_activities',
    entity_id: activity.id,
    summary: `Logged research activity "${activity.title}" (${activity.activity_type})`,
  });

  saveDatabase(db);
  res.status(201).json(activity);
});

// =============================================================================
// 8. COLLABORATORS & RESEARCH OUTPUTS
// =============================================================================

apiRouter.post('/collaborators', requireAuth, requirePermission(PermissionCode.COLLABORATORS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  const orgName = String(body.organization_name ?? '').trim();

  if (!orgName || !body.contact_person || !body.email) {
    res.status(400).json({ error: 'Organization name, contact person, and email are required.' });
    return;
  }

  if (db.collaborators.some((c) => c.organization_name.toLowerCase() === orgName.toLowerCase())) {
    res.status(409).json({ error: `Collaborator '${orgName}' is already registered.` });
    return;
  }

  const now = new Date().toISOString();
  const collab = {
    id: crypto.randomUUID(),
    organization_name: orgName,
    contact_person: String(body.contact_person).trim(),
    email: String(body.email).trim(),
    phone: String(body.phone || ''),
    country: String(body.country || 'Kenya'),
    organization_type: body.organization_type || 'University',
    collaboration_type: body.collaboration_type || 'Joint Research',
    agreement_start_date: String(body.agreement_start_date || now.split('T')[0]),
    agreement_end_date: String(body.agreement_end_date || now.split('T')[0]),
    mou_status: body.mou_status || 'Active',
    notes: String(body.notes || ''),
    created_at: now,
    updated_at: now,
  };

  db.collaborators.unshift(collab);

  if (body.project_id) {
    db.project_collaborators.push({
      id: crypto.randomUUID(),
      project_id: String(body.project_id),
      collaborator_id: collab.id,
      role_description: `${collab.collaboration_type} Partner`,
      created_at: now,
    });
  }

  appendAuditLog(db, {
    actor: req.user!,
    action: 'COLLABORATOR_CREATED',
    entity_type: 'collaborators',
    entity_id: collab.id,
    summary: `Registered partner institution "${collab.organization_name}" (${collab.country})`,
  });

  saveDatabase(db);
  res.status(201).json(collab);
});

apiRouter.post('/outputs', requireAuth, requirePermission(PermissionCode.OUTPUTS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  if (!body.title || !body.lead_scientist_id || !body.journal_or_event) {
    res.status(400).json({ error: 'Title, lead scientist, and journal/event are required.' });
    return;
  }

  const now = new Date().toISOString();
  const output = {
    id: crypto.randomUUID(),
    title: String(body.title).trim(),
    output_type: body.output_type || 'Publication',
    project_id: body.project_id || null,
    lead_scientist_id: String(body.lead_scientist_id),
    journal_or_event: String(body.journal_or_event).trim(),
    doi_or_url: String(body.doi_or_url || ''),
    publication_date: String(body.publication_date || now.split('T')[0]),
    abstract: String(body.abstract || ''),
    manuscript_body: body.manuscript_body ? String(body.manuscript_body) : undefined,
    figure_urls: Array.isArray(body.figure_urls) ? body.figure_urls.map(String) : undefined,
    keywords: Array.isArray(body.keywords)
      ? body.keywords
      : String(body.keywords_text || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
    status: body.status || 'Published',
    created_at: now,
    updated_at: now,
  };

  db.research_outputs.unshift(output);

  // Store lead scientist + any co-authors in output_authors with explicit author_order
  const leadScientist = db.users.find((u) => u.id === output.lead_scientist_id);
  db.output_authors.push({
    id: crypto.randomUUID(),
    output_id: output.id,
    user_id: output.lead_scientist_id,
    external_author_name: leadScientist ? `${leadScientist.title} ${leadScientist.full_name}` : 'Lead Author',
    affiliation: 'Kenya Marine and Fisheries Research Institute (KMFRI)',
    author_order: 1,
    is_corresponding: true,
    created_at: now,
  });

  if (Array.isArray(body.co_authors)) {
    body.co_authors.forEach((co: any, index: number) => {
      db.output_authors.push({
        id: crypto.randomUUID(),
        output_id: output.id,
        user_id: co.user_id || null,
        external_author_name: String(co.name || 'Co-Author'),
        affiliation: String(co.affiliation || 'KMFRI'),
        author_order: index + 2,
        is_corresponding: false,
        created_at: now,
      });
    });
  }

  appendAuditLog(db, {
    actor: req.user!,
    action: 'RESEARCH_OUTPUT_CREATED',
    entity_type: 'research_outputs',
    entity_id: output.id,
    summary: `Catalogued ${output.output_type}: "${output.title}" (${output.status})`,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'research_outputs', id: output.id });
  res.status(201).json(output);
});

apiRouter.put('/outputs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const output = db.research_outputs.find((o) => o.id === req.params.id);
  if (!output) {
    res.status(404).json({ error: 'Publication / Research output not found.' });
    return;
  }

  const body = req.body ?? {};
  const previousStatus = output.status;
  if (body.title !== undefined) output.title = String(body.title).trim();
  if (body.output_type !== undefined) output.output_type = body.output_type;
  if (body.project_id !== undefined) output.project_id = body.project_id || null;
  if (body.lead_scientist_id !== undefined) output.lead_scientist_id = String(body.lead_scientist_id);
  if (body.journal_or_event !== undefined) output.journal_or_event = String(body.journal_or_event).trim();
  if (body.doi_or_url !== undefined) output.doi_or_url = String(body.doi_or_url);
  if (body.publication_date !== undefined) output.publication_date = String(body.publication_date);
  if (body.abstract !== undefined) output.abstract = String(body.abstract);
  if (body.manuscript_body !== undefined) output.manuscript_body = String(body.manuscript_body);
  if (Array.isArray(body.figure_urls)) output.figure_urls = body.figure_urls.map(String);
  if (body.keywords_text !== undefined) {
    output.keywords = String(body.keywords_text)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
  if (body.status !== undefined) output.status = body.status;
  output.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: previousStatus !== output.status ? 'RESEARCH_OUTPUT_STATUS_CHANGED' : 'RESEARCH_OUTPUT_UPDATED',
    entity_type: 'research_outputs',
    entity_id: output.id,
    summary: `Updated publication "${output.title}" (Status: ${previousStatus} → ${output.status})`,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'research_outputs', id: output.id });
  res.json(output);
});

apiRouter.delete('/outputs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const idx = db.research_outputs.findIndex((o) => o.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: 'Research output not found.' });
    return;
  }
  const removed = db.research_outputs[idx];
  db.research_outputs.splice(idx, 1);
  db.output_authors = db.output_authors.filter((oa) => oa.output_id !== removed.id);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'RESEARCH_OUTPUT_DELETED',
    entity_type: 'research_outputs',
    entity_id: removed.id,
    summary: `Deleted ${removed.output_type}: "${removed.title}"`,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'research_outputs', id: removed.id });
  res.json({ success: true });
});

// =============================================================================
// 9. DOCUMENTS & STORAGE UPLOAD (WITH VERSIONING)
// =============================================================================

apiRouter.post('/documents', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  if (!body.title || !body.file_name) {
    res.status(400).json({ error: 'Document title and file name are required.' });
    return;
  }

  // Compute version if same title/category/entity already exists
  const existingVersions = db.documents.filter(
    (d) =>
      d.title.toLowerCase() === String(body.title).trim().toLowerCase() &&
      d.category === (body.category || 'Project Document') &&
      d.project_id === (body.project_id || null)
  );
  const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map((d) => d.version)) + 1 : 1;

  const docRecord = {
    id: crypto.randomUUID(),
    title: String(body.title).trim(),
    file_name: String(body.file_name),
    mime_type: String(body.mime_type || 'application/pdf'),
    file_size_bytes: Number(body.file_size_bytes || 0),
    storage_path: `/storage/kmfri/${crypto.randomUUID()}/${String(body.file_name)}`,
    data_url: body.data_url ? String(body.data_url) : undefined,
    category: body.category || 'Project Document',
    folder_id: body.folder_id || null,
    project_id: body.project_id || null,
    report_id: body.report_id || null,
    output_id: body.output_id || null,
    funding_id: body.funding_id || null,
    collaborator_id: body.collaborator_id || null,
    version: nextVersion,
    uploaded_by: req.user!.id,
    metadata: body.metadata || {},
    created_at: new Date().toISOString(),
  };

  db.documents.unshift(docRecord);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'DOCUMENT_UPLOADED',
    entity_type: 'documents',
    entity_id: docRecord.id,
    summary: `Uploaded ${docRecord.category} "${docRecord.title}" (v${docRecord.version}, ${docRecord.file_name})`,
    metadata: { folder_id: docRecord.folder_id, mime_type: docRecord.mime_type },
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'documents', id: docRecord.id });
  res.status(201).json(docRecord);
});

apiRouter.delete('/documents/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const idx = db.documents.findIndex((d) => d.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }
  const removed = db.documents[idx];
  db.documents.splice(idx, 1);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'DOCUMENT_DELETED',
    entity_type: 'documents',
    entity_id: removed.id,
    summary: `Deleted file/document "${removed.title}" (${removed.file_name})`,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'documents', id: removed.id });
  res.json({ success: true });
});

// Shared Folders Management
apiRouter.post('/folders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  const name = String(body.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'Folder name is required.' });
    return;
  }

  const now = new Date().toISOString();
  const folder: SharedFolder = {
    id: crypto.randomUUID(),
    name,
    description: String(body.description || ''),
    directorate_id: body.directorate_id || null,
    project_id: body.project_id || null,
    created_by: req.user!.id,
    created_by_name: `${req.user!.title} ${req.user!.full_name}`,
    color: String(body.color || 'sky'),
    created_at: now,
    updated_at: now,
  };

  db.shared_folders.unshift(folder);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'SHARED_FOLDER_CREATED',
    entity_type: 'folders',
    entity_id: folder.id,
    summary: `Created shared research folder "${folder.name}"`,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'folders', id: folder.id });
  res.status(201).json(folder);
});

apiRouter.delete('/folders/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const idx = db.shared_folders.findIndex((f) => f.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: 'Folder not found.' });
    return;
  }
  const removed = db.shared_folders[idx];
  db.shared_folders.splice(idx, 1);
  // Unlink documents from deleted folder without deleting the documents
  db.documents.forEach((d) => {
    if (d.folder_id === removed.id) d.folder_id = null;
  });

  appendAuditLog(db, {
    actor: req.user!,
    action: 'SHARED_FOLDER_DELETED',
    entity_type: 'folders',
    entity_id: removed.id,
    summary: `Deleted shared folder "${removed.name}"`,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('db:updated', { entity: 'folders', id: removed.id });
  res.json({ success: true });
});

// =============================================================================
// 10. NOTIFICATIONS & ADMINISTRATION (REFERENCE TABLES, RBAC, SETTINGS)
// =============================================================================

apiRouter.post('/notifications/mark-read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const { notification_id, mark_all } = req.body ?? {};
  if (mark_all) {
    db.notifications.forEach((n) => {
      if (!n.recipient_user_id || n.recipient_user_id === req.user!.id) {
        n.is_read = true;
      }
    });
  } else if (notification_id) {
    const item = db.notifications.find((n) => n.id === notification_id);
    if (item) item.is_read = true;
  }
  saveDatabase(db);
  res.json({ success: true });
});

apiRouter.post('/notifications/broadcast', requireAuth, requirePermission(PermissionCode.SETTINGS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const { title, message, category } = req.body ?? {};
  if (!title || !message) {
    res.status(400).json({ error: 'Announcement title and message are required.' });
    return;
  }
  const notif = appendNotification(db, {
    recipient_user_id: null,
    category: category || 'Announcement',
    title: String(title).trim(),
    message: String(message).trim(),
  });
  appendAuditLog(db, {
    actor: req.user!,
    action: 'INSTITUTIONAL_ANNOUNCEMENT_BROADCAST',
    entity_type: 'notifications',
    entity_id: notif.id,
    summary: `Broadcast announcement: "${notif.title}"`,
  });
  saveDatabase(db);
  res.status(201).json(notif);
});

apiRouter.post('/admin/directorates', requireAuth, requirePermission(PermissionCode.SETTINGS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const { code, name, headquarters, description } = req.body ?? {};
  if (!code || !name) {
    res.status(400).json({ error: 'Directorate code and name are required.' });
    return;
  }
  const normCode = String(code).trim().toUpperCase();
  if (db.directorates.some((d) => d.code.toUpperCase() === normCode)) {
    res.status(409).json({ error: `Directorate code '${normCode}' already exists.` });
    return;
  }
  const now = new Date().toISOString();
  const dir = {
    id: crypto.randomUUID(),
    code: normCode,
    name: String(name).trim(),
    headquarters: String(headquarters || 'Mombasa Headquarters'),
    description: String(description || ''),
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  db.directorates.push(dir);
  appendAuditLog(db, {
    actor: req.user!,
    action: 'DIRECTORATE_CREATED',
    entity_type: 'directorates',
    entity_id: dir.id,
    summary: `Added directorate ${dir.code} — ${dir.name}`,
  });
  saveDatabase(db);
  res.status(201).json(dir);
});

apiRouter.post('/admin/research-areas', requireAuth, requirePermission(PermissionCode.SETTINGS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const { code, name, directorate_id, description } = req.body ?? {};
  if (!code || !name || !directorate_id) {
    res.status(400).json({ error: 'Research area code, name, and directorate are required.' });
    return;
  }
  const normCode = String(code).trim().toUpperCase();
  if (db.research_areas.some((r) => r.code.toUpperCase() === normCode)) {
    res.status(409).json({ error: `Research area code '${normCode}' already exists.` });
    return;
  }
  const now = new Date().toISOString();
  const area = {
    id: crypto.randomUUID(),
    code: normCode,
    name: String(name).trim(),
    directorate_id: String(directorate_id),
    description: String(description || ''),
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  db.research_areas.push(area);
  appendAuditLog(db, {
    actor: req.user!,
    action: 'RESEARCH_AREA_CREATED',
    entity_type: 'research_areas',
    entity_id: area.id,
    summary: `Added research area ${area.code} — ${area.name}`,
  });
  saveDatabase(db);
  res.status(201).json(area);
});

apiRouter.post('/admin/role-permissions/toggle', requireAuth, requirePermission(PermissionCode.ROLES_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const { role_id, permission_id } = req.body ?? {};
  if (!role_id || !permission_id) {
    res.status(400).json({ error: 'role_id and permission_id are required.' });
    return;
  }

  const existingIdx = db.role_permissions.findIndex(
    (rp) => rp.role_id === role_id && rp.permission_id === permission_id
  );
  const role = db.roles.find((r) => r.id === role_id);
  const perm = db.permissions.find((p) => p.id === permission_id);

  if (existingIdx >= 0) {
    db.role_permissions.splice(existingIdx, 1);
    appendAuditLog(db, {
      actor: req.user!,
      action: 'RBAC_PERMISSION_REVOKED',
      entity_type: 'role_permissions',
      entity_id: role_id,
      summary: `Revoked permission '${perm?.code}' from role '${role?.name}'`,
    });
  } else {
    db.role_permissions.push({
      id: crypto.randomUUID(),
      role_id,
      permission_id,
      created_at: new Date().toISOString(),
    });
    appendAuditLog(db, {
      actor: req.user!,
      action: 'RBAC_PERMISSION_GRANTED',
      entity_type: 'role_permissions',
      entity_id: role_id,
      summary: `Granted permission '${perm?.code}' to role '${role?.name}'`,
    });
  }

  saveDatabase(db);
  res.json(db.role_permissions);
});

apiRouter.put('/admin/settings/:key', requireAuth, requirePermission(PermissionCode.SETTINGS_MANAGE), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const setting = db.system_settings.find((s) => s.setting_key === req.params.key);
  if (!setting) {
    res.status(404).json({ error: 'System setting not found.' });
    return;
  }
  setting.setting_value = req.body?.setting_value ?? setting.setting_value;
  setting.updated_by = req.user!.id;
  setting.updated_at = new Date().toISOString();

  appendAuditLog(db, {
    actor: req.user!,
    action: 'SYSTEM_SETTING_UPDATED',
    entity_type: 'system_settings',
    entity_id: setting.id,
    summary: `Updated institutional setting '${setting.setting_key}'`,
    metadata: setting.setting_value,
  });

  saveDatabase(db);
  res.json(setting);
});

// =============================================================================
// 11. REAL-TIME SCIENTIST LIVE CHAT & FILE / FOLDER / IMAGE SHARING
// =============================================================================

apiRouter.get('/chat/presence', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ onlineUserIds: getOnlineUserIds() });
});

apiRouter.post('/chat/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const body = req.body ?? {};
  const content = String(body.content ?? '').trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!content && attachments.length === 0) {
    res.status(400).json({ error: 'Message content or attachment is required.' });
    return;
  }

  const sender = db.users.find((u) => u.id === req.user!.id) || req.user!;
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    channel_id: String(body.channel_id || 'general-research'),
    sender_id: sender.id,
    sender_name: sender.full_name,
    sender_title: sender.title,
    sender_role: sender.role_code,
    sender_avatar: sender.avatar_url,
    sender_station: sender.office_station,
    content,
    attachments,
    created_at: new Date().toISOString(),
  };

  db.chat_messages.push(msg);

  if (attachments.length > 0) {
    appendAuditLog(db, {
      actor: sender,
      action: 'CHAT_RESOURCE_SHARED',
      entity_type: 'chat',
      entity_id: msg.id,
      summary: `${sender.title} ${sender.full_name} shared ${attachments.length} attachment(s) in channel '${msg.channel_id}'`,
      metadata: {
        channel_id: msg.channel_id,
        attachments: attachments.map((a: any) => ({ type: a.type, title: a.title })),
      },
    });
  }

  saveDatabase(db);
  broadcastNewChatMessage(msg);
  res.status(201).json(msg);
});

apiRouter.delete('/chat/messages/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const idx = db.chat_messages.findIndex((m) => m.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: 'Chat message not found.' });
    return;
  }
  const msg = db.chat_messages[idx];
  const isAdmin = userHasPermission(db, req.user!, PermissionCode.USERS_MANAGE);
  if (msg.sender_id !== req.user!.id && !isAdmin) {
    res.status(403).json({ error: 'You can only delete your own chat messages.' });
    return;
  }

  db.chat_messages.splice(idx, 1);

  appendAuditLog(db, {
    actor: req.user!,
    action: 'CHAT_MESSAGE_DELETED',
    entity_type: 'chat',
    entity_id: msg.id,
    summary: `Deleted chat message from channel '${msg.channel_id}'`,
  });

  saveDatabase(db);
  broadcastRealtimeEvent('chat:message_deleted', { id: msg.id });
  res.json({ success: true });
});

// =============================================================================
// 12. KMFRI GEMINI AI RESEARCH ASSISTANT (MULTI-TURN, SEARCH & MAPS GROUNDING)
// =============================================================================

apiRouter.post('/ai/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    res.status(503).json({
      error: 'Gemini API key is not configured yet. Please check your API key in Settings > Secrets.',
    });
    return;
  }

  const {
    messages = [],
    mode = 'general', // 'general' | 'fast' | 'complex' | 'search' | 'maps'
    latitude,
    longitude,
  } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Conversation messages are required.' });
    return;
  }

  const db = loadDatabase();

  // Build contextual institutional summary for the KMFRI AI Assistant
  const directorateNames = db.directorates.map((d) => `${d.code} (${d.name})`).join(', ');
  const researchAreaNames = db.research_areas.map((a) => `${a.code}: ${a.name}`).join('; ');
  const projectsSummary = db.projects
    .slice(0, 15)
    .map((p) => `${p.project_code}: "${p.title}" [${p.status}, Progress: ${p.progress_percent}%, Budget: ${p.currency} ${p.budget}]`)
    .join('\n- ');
  const scientistsSummary = db.users
    .filter((u) => u.is_operational_scientist)
    .slice(0, 15)
    .map((s) => `${s.title} ${s.full_name} (${s.staff_number}, ${s.position}, Station: ${s.office_station})`)
    .join('\n- ');
  const outputsSummary = db.research_outputs
    .slice(0, 10)
    .map((o) => `[${o.output_type}] "${o.title}" (${o.journal_or_event}, ${o.publication_date})`)
    .join('\n- ');
  const locationsSummary = db.locations
    .slice(0, 15)
    .map((l) => `${l.site_name} (${l.county}, ${l.marine_coastal_area}: [${l.latitude}, ${l.longitude}])`)
    .join('\n- ');

  const systemInstruction = `You are the official KMFRI (Kenya Marine and Fisheries Research Institute) Senior Scientific AI Assistant and Marine Research Advisor.
You assist KMFRI scientists, Principal Investigators, Directorate Heads, and Management with:
1. Marine ecology, oceanography, coral reef resilience, blue carbon (mangroves & seagrass), inland freshwater limnology (Lake Victoria, Lake Turkana, etc.), aquaculture, and Blue Economy socio-economics.
2. Drafting and reviewing scientific publications, technical reports, research project proposals, and grant applications.
3. Exploring GIS sampling stations, coastal/marine geography in Kenya and the Western Indian Ocean, and up-to-date scientific literature.

Current Logged-In User: ${req.user!.title} ${req.user!.full_name} (${req.user!.role_code}, ${req.user!.office_station})

Live KMFRI Institutional Database Snapshot:
- Directorates (${db.directorates.length}): ${directorateNames}
- Research Areas (${db.research_areas.length}): ${researchAreaNames}
- Registered Operational Scientists (${db.users.filter((u) => u.is_operational_scientist).length}):
${scientistsSummary || 'None registered yet.'}
- Active/Catalogued Research Projects (${db.projects.length}):
${projectsSummary || 'None created yet.'}
- GIS Sampling Stations (${db.locations.length}):
${locationsSummary || 'None registered yet.'}
- Publications & Research Outputs (${db.research_outputs.length}):
${outputsSummary || 'None catalogued yet.'}

Provide clear, rigorous, well-structured scientific responses. Format with Markdown headings, bullet points, and tables where helpful.`;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Determine target model as specified by the user's requirements
  let targetModel = 'gemini-3.5-flash';
  if (mode === 'fast') {
    targetModel = 'gemini-3.1-flash-lite';
  } else if (mode === 'complex') {
    targetModel = 'gemini-3.1-pro-preview';
  } else if (mode === 'search' || mode === 'maps') {
    targetModel = 'gemini-3.5-flash';
  }

  // Format multi-turn conversation history for generateContent
  const contents = messages.map((m: { role: string; text: string }) => ({
    role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.text || '') }],
  }));

  const buildConfig = () => {
    const cfg: Record<string, any> = {
      systemInstruction,
    };
    if (mode === 'search') {
      cfg.tools = [{ googleSearch: {} }];
    } else if (mode === 'maps') {
      cfg.tools = [{ googleMaps: {} }];
      const lat = typeof latitude === 'number' ? latitude : -4.0547; // Default KMFRI Mombasa HQ
      const lng = typeof longitude === 'number' ? longitude : 39.6636;
      cfg.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng,
          },
        },
      };
    }
    return cfg;
  };

  try {
    let response;
    let actualModelUsed = targetModel;
    try {
      response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config: buildConfig(),
      });
    } catch (primaryErr: any) {
      // Fallback gracefully to gemini-3.5-flash or gemini-flash-latest if model alias / quota requires it
      actualModelUsed = 'gemini-flash-latest';
      response = await ai.models.generateContent({
        model: actualModelUsed,
        contents,
        config: buildConfig(),
      });
    }

    const replyText = response.text || 'No response generated.';
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const webSources: Array<{ uri: string; title: string }> = [];
    const mapSources: Array<{ uri: string; title: string; reviewSnippets?: string[] }> = [];

    for (const chunk of chunks as any[]) {
      if (chunk.web?.uri) {
        webSources.push({
          uri: String(chunk.web.uri),
          title: String(chunk.web.title || chunk.web.uri),
        });
      }
      if (chunk.maps?.uri) {
        const snippets: string[] = [];
        if (Array.isArray(chunk.maps.placeAnswerSources?.reviewSnippets)) {
          for (const s of chunk.maps.placeAnswerSources.reviewSnippets) {
            if (s?.text) snippets.push(String(s.text));
            else if (typeof s === 'string') snippets.push(s);
          }
        }
        mapSources.push({
          uri: String(chunk.maps.uri),
          title: String(chunk.maps.title || 'Google Maps Location'),
          reviewSnippets: snippets,
        });
      }
    }

    res.json({
      reply: replyText,
      modelUsed: actualModelUsed,
      mode,
      webSources,
      mapSources,
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Failed to generate AI response. Please verify your Gemini API key in Settings > Secrets.',
    });
  }
});
