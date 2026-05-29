import type { FastifyInstance } from "fastify";
import { AlertListQuerySchema } from "@nexus/shared";
import { AlertsService } from "./alerts.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";
import { NotFoundError } from "../../lib/errors.js";

export async function alertsRoutes(app: FastifyInstance) {
  const service = new AlertsService(app.db, app.pgClient);

  app.get("/v1/alerts", {
    preHandler: authGuard(app.env, "view:alerts"),
  }, async (request, reply) => {
    const query = AlertListQuerySchema.parse(request.query);
    const result = await service.list(getUser(request).orgId, query);
    return reply.send(result);
  });

  app.patch("/v1/alerts/:id/acknowledge", {
    preHandler: authGuard(app.env, "act:incidents"),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const alert = await service.acknowledge(getUser(request).orgId, id);
    if (!alert) throw new NotFoundError("Alert not found");
    return reply.send(alert);
  });
}
