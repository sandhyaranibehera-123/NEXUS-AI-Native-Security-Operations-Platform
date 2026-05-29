import type { FastifyInstance } from "fastify";
import { SecurityEventListQuerySchema } from "@nexus/shared";
import { EventsService } from "./events.service.js";
import { authenticate, requirePermission } from "../../middleware/authenticate.js";
import { NotFoundError } from "../../lib/errors.js";

export async function eventsRoutes(app: FastifyInstance) {
  const service = new EventsService(app.db, app.pgClient);

  app.get("/v1/events", {
    preHandler: [authenticate(app.env), requirePermission("view:events")],
  }, async (request, reply) => {
    const query = SecurityEventListQuerySchema.parse(request.query);
    const result = await service.list(request.user!.orgId, query);
    return reply.send(result);
  });

  app.get("/v1/events/:id", {
    preHandler: [authenticate(app.env), requirePermission("view:events")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await service.getById(request.user!.orgId, id);
    if (!event) throw new NotFoundError("Event not found");
    return reply.send(event);
  });
}
