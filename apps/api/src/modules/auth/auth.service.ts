import bcrypt from "bcryptjs";
import { eq, and, gt, sql } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { users, roles, userSessions, organizations } from "@nexus/db/schema";
import type postgres from "postgres";
import { UnauthorizedError } from "../../lib/errors.js";
import { signAccessToken, signRefreshToken, type JwtPayload } from "../../middleware/authenticate.js";
import type { Env } from "../../config/env.js";
import { withTenant } from "../../lib/tenant.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Demo passwords only available in non-production environments
const DEMO_PASSWORDS: Record<string, string> =
  process.env.NODE_ENV === "production"
    ? {}
    : {
        "admin@acme.federal": "NexusSuperAdmin#2024",
        "amelia.lee@acme.federal": "NexusDemo2024!",
        "j.okafor@acme.federal": "SOCAnalyst@2024",
        "h.tanaka@acme.federal": "ThreatHunt#2024",
        "marco.cruz@acme.federal": "Respond2024!",
        "n.patel@acme.federal": "Compliance#24",
        "s.ivanov@acme.federal": "ViewOnly2024",
      };

export class AuthService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
    private env: Env,
  ) {}

  async login(email: string, password: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        organizationId: users.organizationId,
        avatarSeed: users.avatarSeed,
        workspaceName: users.workspaceName,
        roleName: roles.name,
        permissions: roles.permissions,
        orgName: organizations.name,
        status: users.status,
        failedLoginCount: users.failedLoginCount,
        lockedUntil: users.lockedUntil,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.email, email))
      .limit(1);

    // Generic error to prevent user enumeration
    if (!user) throw new UnauthorizedError("Invalid credentials");

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60_000);
      throw new UnauthorizedError(`Account locked. Try again in ${remainingMin} minute(s)`);
    }

    if (user.status === "disabled") {
      throw new UnauthorizedError("Account disabled");
    }

    const isDemoPass = DEMO_PASSWORDS[user.email] === password;
    const valid =
      isDemoPass ||
      (user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false);

    if (!valid) {
      const newCount = (user.failedLoginCount ?? 0) + 1;
      const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;
      await this.db
        .update(users)
        .set({
          failedLoginCount: newCount,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        })
        .where(eq(users.id, user.id));
      throw new UnauthorizedError("Invalid credentials");
    }

    // Reset failed counter on successful login
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id));

    const permissions = Array.isArray(user.permissions) ? (user.permissions as string[]) : [];

    const payload: JwtPayload = {
      sub: user.id,
      orgId: user.organizationId,
      role: user.roleName ?? "viewer",
      permissions,
      email: user.email,
      name: user.fullName,
    };

    const accessToken = signAccessToken(payload, this.env);
    const refreshToken = signRefreshToken(user.id, this.env);

    await this.db.insert(userSessions).values({
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: user.roleName ?? "viewer",
        organizationId: user.organizationId,
        workspace: user.workspaceName ?? user.orgName ?? "Default",
        avatarSeed: user.avatarSeed ?? user.email,
        permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    const { verifyRefreshToken } = await import("../../middleware/authenticate.js");
    const { sub: userId } = verifyRefreshToken(refreshToken, this.env);

    const [session] = await this.db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.refreshToken, refreshToken),
          eq(userSessions.isRevoked, false),
          gt(userSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) throw new UnauthorizedError("Session expired or revoked");

    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        organizationId: users.organizationId,
        avatarSeed: users.avatarSeed,
        workspaceName: users.workspaceName,
        roleName: roles.name,
        permissions: roles.permissions,
        orgName: organizations.name,
        status: users.status,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.status === "disabled") throw new UnauthorizedError("User not found");

    // Update last active
    void this.db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId));

    const permissions = Array.isArray(user.permissions) ? (user.permissions as string[]) : [];
    const payload: JwtPayload = {
      sub: user.id,
      orgId: user.organizationId,
      role: user.roleName ?? "viewer",
      permissions,
      email: user.email,
      name: user.fullName,
    };

    return {
      accessToken: signAccessToken(payload, this.env),
      refreshToken,
      expiresIn: 900,
    };
  }

  async me(userId: string, orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const [user] = await this.db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          organizationId: users.organizationId,
          avatarSeed: users.avatarSeed,
          workspaceName: users.workspaceName,
          roleName: roles.name,
          permissions: roles.permissions,
          mfaEnabled: users.mfaEnabled,
          department: users.department,
          phone: users.phone,
          riskScore: users.riskScore,
          lastActiveAt: users.lastActiveAt,
        })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) throw new UnauthorizedError("User not found");

      return {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: user.roleName ?? "viewer",
        organizationId: user.organizationId,
        workspace: user.workspaceName ?? "Default",
        avatarSeed: user.avatarSeed ?? user.email,
        permissions: Array.isArray(user.permissions) ? (user.permissions as string[]) : [],
        mfaEnabled: user.mfaEnabled,
        department: user.department,
        phone: user.phone,
        riskScore: user.riskScore,
        lastActiveAt: user.lastActiveAt?.toISOString(),
      };
    });
  }

  async logout(refreshToken: string) {
    await this.db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(eq(userSessions.refreshToken, refreshToken));
  }

  async revokeAllSessions(userId: string) {
    await this.db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isRevoked, false)));
  }

  async listSessions(userId: string) {
    return this.db
      .select({
        id: userSessions.id,
        ipAddress: userSessions.ipAddress,
        userAgent: userSessions.userAgent,
        createdAt: userSessions.createdAt,
        expiresAt: userSessions.expiresAt,
      })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isRevoked, false),
          gt(userSessions.expiresAt, new Date()),
        ),
      )
      .orderBy(sql`${userSessions.createdAt} DESC`)
      .limit(20);
  }
}
