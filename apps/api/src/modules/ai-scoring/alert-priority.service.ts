import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { DbClient } from "@nexus/db";
import { alerts } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { authenticate, requirePermission } from "../../middleware/authenticate.js";

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 40, high: 30, medium: 15, low: 8, info: 3, healthy: 0,
};

export class AlertPriorityService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
  ) {}

  computeScore(severity: string, dedupCount: number, mitreMatch = false, assetCriticality = 0): number {
    const base = SEVERITY_WEIGHTS[severity] ?? 10;
    const dedupBonus = Math.min(dedupCount * 5, 25);
    const mitreBonus = mitreMatch ? 15 : 0;
    const assetBonus = Math.min(assetCriticality, 20);
    return Math.min(100, base + dedupBonus + mitreBonus + assetBonus);
  }

  async rescoreAll(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select()
        .from(alerts)
        .where(eq(alerts.organizationId, orgId));

      for (const row of rows) {
        const score = this.computeScore(row.severity, row.dedupCount ?? 1);
        await this.db
          .update(alerts)
          .set({ aiPriorityScore: score })
          .where(eq(alerts.id, row.id));
      }
      return { updated: rows.length };
    });
  }
}

export async function aiScoringRoutes(app: FastifyInstance) {
  const service = new AlertPriorityService(app.db, app.pgClient);

  app.post("/v1/ai/score/rescore", {
    preHandler: [authenticate(app.env), requirePermission("manage:settings")],
  }, async (request, reply) => {
    const result = await service.rescoreAll(request.user!.orgId);
    return reply.send(result);
  });
}
