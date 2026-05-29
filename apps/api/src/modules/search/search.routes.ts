import type { FastifyInstance } from "fastify";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { incidents, alerts, securityEvents, knowledgeArticles } from "@nexus/db/schema";
import { withTenant } from "../../lib/tenant.js";
import { authenticate } from "../../middleware/authenticate.js";

export async function searchRoutes(app: FastifyInstance) {
  app.get("/v1/search", {
    preHandler: authenticate(app.env),
  }, async (request, reply) => {
    const { q = "" } = request.query as { q?: string };
    const orgId = request.user!.orgId;
    const term = `%${q}%`;

    const results = await withTenant(app.pgClient, orgId, async () => {
      const [incidentHits, alertHits, eventHits, kbHits] = await Promise.all([
        app.db.select({
          id: incidents.id,
          label: incidents.incidentCode,
          title: incidents.title,
          type: sql<string>`'incident'`,
        })
          .from(incidents)
          .where(and(eq(incidents.organizationId, orgId), or(ilike(incidents.title, term), ilike(incidents.incidentCode, term))))
          .limit(5),
        app.db.select({
          id: alerts.id,
          label: alerts.title,
          title: alerts.title,
          type: sql<string>`'alert'`,
        })
          .from(alerts)
          .where(and(eq(alerts.organizationId, orgId), ilike(alerts.title, term)))
          .limit(5),
        app.db.select({
          id: securityEvents.id,
          label: securityEvents.ruleName,
          title: securityEvents.message,
          type: sql<string>`'event'`,
        })
          .from(securityEvents)
          .where(and(eq(securityEvents.organizationId, orgId), ilike(securityEvents.message, term)))
          .limit(5),
        app.db.select({
          id: knowledgeArticles.id,
          label: knowledgeArticles.slug,
          title: knowledgeArticles.title,
          type: sql<string>`'knowledge'`,
        })
          .from(knowledgeArticles)
          .where(and(eq(knowledgeArticles.organizationId, orgId), ilike(knowledgeArticles.title, term)))
          .limit(5),
      ]);
      return [...incidentHits, ...alertHits, ...eventHits, ...kbHits];
    });

    return reply.send({ items: results });
  });
}
