import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../lib/password.ts';

export interface AuthRequest extends Request {
  user?: { uid: string; email?: string; name?: string; picture?: string };
  dbUser?: {
    id: string;
    uid: string;
    fullName: string;
    email: string;
    roleId: string | null;
    roleName: string;
    directorateId: string | null;
    researchAreaId: string | null;
    status: string;
    staffNumber: string | null;
    position: string | null;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1];
  const session = verifySessionToken(token);
  if (!session) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Session expired or invalid. Please sign in again.' });
  }

  req.user = {
    uid: session.uid,
    email: session.email,
    name: session.name,
  };
  return next();
};
