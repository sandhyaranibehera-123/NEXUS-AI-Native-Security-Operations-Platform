import type { FastifyInstance } from "fastify";
import { AttackGraphService } from "./attack-graph.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";
import { NotFoundError } from "../../lib/errors.js";

export async function attackGraphRoutes(app: FastifyInstance) {
  const service = new AttackGraphService(app.db, app.pgClient);

  app.get("/v1/attack-graphs", {
    preHandler: authGuard(app.env, "view:attack-graph"),
  }, async (request, reply) => {
    const items = await service.list(getUser(request).orgId);
    return reply.send({ items });
  });

  app.get("/v1/attack-graphs/:id", {
    preHandler: authGuard(app.env, "view:attack-graph"),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const graph = await service.getGraphDetail(id, getUser(request).orgId);
    if (!graph) throw new NotFoundError("Attack graph not found");
    return reply.send(graph);
  });
}
