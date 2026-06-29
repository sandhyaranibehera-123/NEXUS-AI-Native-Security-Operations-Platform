import { eq, and } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { users, roles, identityAnomalies } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class UsersService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          status: users.status,
          roleName: roles.name,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.organizationId, orgId));

      return rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.fullName,
        status: u.status,
        role: u.roleName,
        lastLoginAt: u.lastLoginAt?.toISOString(),
        createdAt: u.createdAt?.toISOString(),
      }));
    });
  }

  async create(orgId: string, data: { email: string; fullName: string; role?: string }) {
    return withTenant(this.db, orgId, async () => {
      let roleId: string | undefined;
      if (data.role) {
        const [roleRow] = await this.db
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.name, data.role), eq(roles.organizationId, orgId)))
          .limit(1);
        roleId = roleRow?.id;
      }

      const [row] = await this.db
        .insert(users)
        .values({
          organizationId: orgId,
          roleId,
          email: data.email,
          fullName: data.fullName,
          status: "pending",
          avatarSeed: data.fullName.toLowerCase().replace(/\s+/g, "."),
        })
        .returning();

      return {
        id: row.id,
        email: row.email,
        name: row.fullName,
        status: row.status,
        role: data.role ?? "viewer",
        createdAt: row.createdAt?.toISOString(),
      };
    });
  }

  async update(orgId: string, id: string, data: { fullName?: string; role?: string; status?: string }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

      if (data.fullName !== undefined) updates.fullName = data.fullName;
      if (data.status !== undefined) updates.status = data.status;

      if (data.role !== undefined) {
        const [roleRow] = await this.db
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.name, data.role), eq(roles.organizationId, orgId)))
          .limit(1);
        if (roleRow) updates.roleId = roleRow.id;
      }

      const [row] = await this.db
        .update(users)
        .set(updates)
        .where(and(eq(users.id, id), eq(users.organizationId, orgId)))
        .returning({ id: users.id, email: users.email, fullName: users.fullName, status: users.status, roleId: users.roleId });

      if (!row) return null;

      let roleName: string | null = null;
      if (row.roleId) {
        const [roleRow] = await this.db.select({ name: roles.name }).from(roles).where(eq(roles.id, row.roleId)).limit(1);
        roleName = roleRow?.name ?? null;
      }

      return {
        id: row.id,
        email: row.email,
        name: row.fullName,
        status: row.status,
        role: roleName ?? data.role ?? "viewer",
      };
    });
  }

  async delete(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db.delete(users).where(and(eq(users.id, id), eq(users.organizationId, orgId)));
    });
  }

  async listIdentityAnomalies(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({
          anomaly: identityAnomalies,
          userEmail: users.email,
        })
        .from(identityAnomalies)
        .innerJoin(users, eq(identityAnomalies.userId, users.id))
        .where(and(eq(identityAnomalies.organizationId, orgId), eq(identityAnomalies.isResolved, false)));

      return rows.map(({ anomaly, userEmail }) => ({
        id: anomaly.id,
        userEmail,
        type: anomaly.anomalyType,
        severity: anomaly.severity,
        description: anomaly.description,
        detectedAt: anomaly.detectedAt?.toISOString(),
      }));
    });
  }
}
