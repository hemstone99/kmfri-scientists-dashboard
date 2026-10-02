import crypto from 'crypto';

const TOKEN_SECRET =
  process.env.SQL_PASSWORD ||
  process.env.GEMINI_API_KEY ||
  'kmfri-institutional-session-secret-2026';

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plainPassword: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !storedHash.startsWith('scrypt$')) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, salt, originalHash] = parts;
  const derived = crypto.scryptSync(plainPassword, salt, 64);
  const originalBuf = Buffer.from(originalHash, 'hex');
  if (derived.length !== originalBuf.length) return false;
  return crypto.timingSafeEqual(derived, originalBuf);
}

export interface SessionPayload {
  uid: string;
  email: string;
  name: string;
  exp: number;
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const dataB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(dataB64)
    .digest('base64url');
  return `kmfri.${dataB64}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token.startsWith('kmfri.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, dataB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(dataB64)
    .digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(dataB64, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
