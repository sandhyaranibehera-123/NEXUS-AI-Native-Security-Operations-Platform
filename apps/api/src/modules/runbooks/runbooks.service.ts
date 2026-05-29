import { eq, and } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { runbooks, runbookSteps } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class RunbooksService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select()
        .from(runbooks)
        .where(eq(runbooks.organizationId, orgId));

      return Promise.all(rows.map(async (r) => {
        const steps = await this.db
          .select()
          .from(runbookSteps)
          .where(eq(runbookSteps.runbookId, r.id))
          .orderBy(runbookSteps.stepOrder);

        return {
          id: r.id,
          name: r.name,
          description: r.description,
          category: r.category,
          isAutomated: r.isAutomated,
          isEnabled: r.isEnabled,
          executionCount: r.executionCount,
          steps: steps.map((s) => ({
            id: s.id,
            order: s.stepOrder,
            name: s.name,
            actionType: s.actionType,
            isManual: s.isManual,
          })),
        };
      }));
    });
  }
}
