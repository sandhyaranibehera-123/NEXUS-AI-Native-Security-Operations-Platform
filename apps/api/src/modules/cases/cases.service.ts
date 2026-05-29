import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { cases, users } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class CasesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, limit = 50) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select({ case: cases, ownerName: users.fullName })
        .from(cases)
        .leftJoin(users, eq(cases.ownerId, users.id))
        .where(eq(cases.organizationId, orgId))
        .orderBy(desc(cases.updatedAt))
        .limit(limit);

      return rows.map(({ case: c, ownerName }) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        description: c.description,
        status: c.status,
        priority: c.priority,
        owner: ownerName ?? "Unassigned",
        tags: (c.tags as string[]) ?? [],
        createdAt: c.createdAt?.toISOString(),
        updatedAt: c.updatedAt?.toISOString(),
      }));
    });
  }
}
