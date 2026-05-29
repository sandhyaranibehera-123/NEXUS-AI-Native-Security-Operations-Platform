import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { EndpointsService } from "./endpoints.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";
import { NotFoundError } from "../../lib/errors.js";

export async function endpointsRoutes(app: FastifyInstance) {
  const service = new EndpointsService(app.db, app.pgClient);

  app.get("/v1/endpoints", {
    preHandler: authGuard(app.env, "view:endpoints"),
  }, async (request, reply) => {
    const { search, limit } = z.object({
      search: z.string().optional(),
      limit: z.coerce.number().max(200).default(50),
    }).parse(request.query);
    const items = await service.list(getUser(request).orgId, search, limit);
    return reply.send({ items });
  });

  app.get("/v1/endpoints/:id", {
    preHandler: authGuard(app.env, "view:endpoints"),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ep = await service.getById(getUser(request).orgId, id);
    if (!ep) throw new NotFoundError("Endpoint not found");
    return reply.send(ep);
  });

  app.post("/v1/endpoints/:id/isolate", {
    preHandler: authGuard(app.env, "act:incidents"),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ep = await service.isolate(getUser(request).orgId, id);
    return reply.send(ep);
  });
}
