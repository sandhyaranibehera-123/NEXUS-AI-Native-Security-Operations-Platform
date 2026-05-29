import type { FastifyInstance } from "fastify";
import { ReportsService } from "./reports.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function reportsRoutes(app: FastifyInstance) {
  const service = new ReportsService(app.db, app.pgClient);

  app.get("/v1/reports", {
    preHandler: authGuard(app.env, "view:reports"),
  }, async (request, reply) => {
    const items = await service.list(getUser(request).orgId);
    return reply.send({ items });
  });
}
