import type { FastifyInstance } from "fastify";
import { IncidentListQuerySchema, UpdateIncidentStatusSchema } from "@nexus/shared";
import { IncidentsService } from "./incidents.service.js";
import { authenticate, requirePermission } from "../../middleware/authenticate.js";
import { NotFoundError } from "../../lib/errors.js";

export async function incidentsRoutes(app: FastifyInstance) {
  const service = new IncidentsService(app.db, app.pgClient);

  app.get("/v1/incidents", {
    preHandler: [authenticate(app.env), requirePermission("view:incidents")],
  }, async (request, reply) => {
    const query = IncidentListQuerySchema.parse(request.query);
    const result = await service.list(request.user!.orgId, query);
    return reply.send(result);
  });

  app.get("/v1/incidents/:id", {
    preHandler: [authenticate(app.env), requirePermission("view:incidents")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    let incident = await service.getById(request.user!.orgId, id);
    if (!incident) incident = await service.getByCode(request.user!.orgId, id);
    if (!incident) throw new NotFoundError("Incident not found");
    return reply.send(incident);
  });

  app.patch("/v1/incidents/:id/status", {
    preHandler: [authenticate(app.env), requirePermission("act:incidents")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateIncidentStatusSchema.parse(request.body);
    const incident = await service.updateStatus(
      request.user!.orgId,
      id,
      body,
      request.user!.name,
    );
    return reply.send(incident);
  });
}
