import type { FastifyInstance } from "fastify";
import { EventsService } from "../events/events.service.js";
import { IncidentsService } from "../incidents/incidents.service.js";
import { AlertsService } from "../alerts/alerts.service.js";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { endpoints } from "@nexus/db/schema";
import { withTenant } from "../../lib/tenant.js";

export class DashboardService {
  constructor(
    private events: EventsService,
    private incidents: IncidentsService,
    private alerts: AlertsService,
    private db: FastifyInstance["db"],
    private client: FastifyInstance["pgClient"],
  ) {}

  async getStats(orgId: string) {
    const [openIncidents, criticalAlerts, eventsLast24h] = await Promise.all([
      this.incidents.countOpen(orgId),
      this.alerts.countCritical(orgId),
      this.events.countLast24h(orgId),
    ]);

    const endpointsAtRisk = await withTenant(this.client, orgId, async () => {
      const [result] = await this.db
        .select({ count: count() })
        .from(endpoints)
        .where(and(
          eq(endpoints.organizationId, orgId),
          sql`${endpoints.riskOverall} >= 70`,
        ));
      return result?.count ?? 0;
    });

    return {
      openIncidents,
      criticalAlerts,
      eventsLast24h,
      meanTimeToDetect: 42,
      endpointsAtRisk,
      complianceScore: 87.5,
    };
  }
}

export async function dashboardRoutes(app: FastifyInstance) {
  const events = new EventsService(app.db, app.pgClient);
  const incidents = new IncidentsService(app.db, app.pgClient);
  const alerts = new AlertsService(app.db, app.pgClient);
  const service = new DashboardService(events, incidents, alerts, app.db, app.pgClient);
  const { authenticate, requirePermission } = await import("../../middleware/authenticate.js");

  app.get("/v1/dashboard/stats", {
    preHandler: [authenticate(app.env), requirePermission("view:dashboard")],
  }, async (request, reply) => {
    const stats = await service.getStats(request.user!.orgId);
    return reply.send(stats);
  });
}
