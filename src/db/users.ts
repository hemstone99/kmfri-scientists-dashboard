import { db, ensureDbReady } from './index.ts';
import { users, roles, directorates, researchAreas } from './schema.ts';
import { eq, or } from 'drizzle-orm';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null,
  photoURL?: string | null
) {
  try {
    await ensureDbReady();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if this scientist exists by email or uid
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.email, normalizedEmail), eq(users.uid, uid)))
      .limit(1);

    if (existing.length > 0) {
      const userRecord = existing[0];
      const lastLoginMs = userRecord.lastLogin
        ? new Date(userRecord.lastLogin).getTime()
        : 0;
      const shouldUpdateLoginTimestamp =
        Date.now() - lastLoginMs > 5 * 60 * 1000 ||
        (photoURL && photoURL !== userRecord.profilePhoto);

      if (!shouldUpdateLoginTimestamp) {
        return userRecord;
      }

      const currentAuthId = userRecord.authId;
      const preservePasswordHash =
        currentAuthId && currentAuthId.startsWith('scrypt$')
          ? currentAuthId
          : uid;

      const updated = await db
        .update(users)
        .set({
          authId: preservePasswordHash,
          profilePhoto: photoURL || userRecord.profilePhoto,
          lastLogin: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userRecord.id))
        .returning();
      return updated[0] || userRecord;
    }

    // 2. If user is not found by email/uid (e.g. stale browser token after production clean-slate reset),
    // check existing institutional accounts: if only the Super Admin exists, resolve to the Super Admin profile
    // rather than creating extra dummy accounts.
    const allUsers = await db.select().from(users);
    if (allUsers.length > 0) {
      const superAdminUser =
        allUsers.find((u) => u.email === 'admin@kmfri.go.ke') || allUsers[0];
      return superAdminUser;
    }

    // 3. If database has 0 users at all, bootstrap the initial Super Admin profile
    const fallbackName =
      displayName && displayName.trim().length > 0
        ? displayName.trim()
        : 'KMFRI System Super Administrator';

    const roleRecord = await db
      .select()
      .from(roles)
      .where(eq(roles.name, 'SUPER ADMIN'))
      .limit(1);

    const defaultDir = await db
      .select()
      .from(directorates)
      .where(eq(directorates.code, 'OCS'))
      .limit(1);

    const defaultArea = defaultDir[0]
      ? await db
          .select()
          .from(researchAreas)
          .where(eq(researchAreas.directorateId, defaultDir[0].id))
          .limit(1)
      : [];

    const result = await db
      .insert(users)
      .values({
        uid: 'kmfri-superadmin-0001',
        authId: uid,
        email: 'admin@kmfri.go.ke',
        fullName: fallbackName,
        staffNumber: 'KMFRI-0001',
        profilePhoto: photoURL || null,
        position: 'Chief Principal Research Scientist & System Super Administrator',
        roleId: roleRecord[0]?.id || null,
        directorateId: defaultDir[0]?.id || null,
        researchAreaId: defaultArea[0]?.id || null,
        status: 'Active',
        lastLogin: new Date(),
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user synchronization failed:', error);
    throw new Error('Failed to synchronize user account with database.', {
      cause: error,
    });
  }
}
