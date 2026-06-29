import { eq, and, desc, ilike, or } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { auditLogs } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class AuditService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, search?: string, limit = 100) {
    return withTenant(this.db, orgId, async () => {
      const conditions = [eq(auditLogs.organizationId, orgId)];
      if (search) {
        conditions.push(or(
          ilike(auditLogs.action, `%${search}%`),
          ilike(auditLogs.userEmail, `%${search}%`),
        )!);
      }

      const rows = await this.db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return rows.map((l) => ({
        id: l.id,
        actor: l.userEmail ?? "system",
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        timestamp: l.timestamp?.toISOString(),
      }));
    });
  }

  async log(orgId: string, entry: {
    userId?: string;
    userEmail?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
  }) {
    await withTenant(this.db, orgId, async () => {
      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId: entry.userId,
        userEmail: entry.userEmail,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
      });
    });
  }
}
