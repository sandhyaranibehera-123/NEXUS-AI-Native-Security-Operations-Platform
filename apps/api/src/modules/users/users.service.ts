import { eq, and } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { users, roles, identityAnomalies } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class UsersService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          status: users.status,
          roleName: roles.name,
          lastLoginAt: users.lastLoginAt,
          riskScore: users.id,
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
      }));
    });
  }

  async listIdentityAnomalies(orgId: string) {
    return withTenant(this.client, orgId, async () => {
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
