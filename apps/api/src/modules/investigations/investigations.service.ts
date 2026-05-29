import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { investigationNotebooks } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class InvestigationsService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, limit = 50) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select()
        .from(investigationNotebooks)
        .where(eq(investigationNotebooks.organizationId, orgId))
        .orderBy(desc(investigationNotebooks.updatedAt))
        .limit(limit);

      return rows.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        caseId: n.caseId,
        incidentId: n.incidentId,
        isPublished: n.isPublished,
        updatedAt: n.updatedAt?.toISOString(),
        createdAt: n.createdAt?.toISOString(),
      }));
    });
  }
}
