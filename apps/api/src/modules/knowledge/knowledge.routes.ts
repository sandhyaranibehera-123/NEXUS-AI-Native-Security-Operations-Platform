import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { KnowledgeService } from "./knowledge.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function knowledgeRoutes(app: FastifyInstance) {
  const service = new KnowledgeService(app.db, app.pgClient);

  app.get("/v1/knowledge", {
    preHandler: authGuard(app.env, "view:knowledge"),
  }, async (request, reply) => {
    const q = z.object({ search: z.string().optional(), category: z.string().optional() }).parse(request.query);
    const items = await service.list(getUser(request).orgId, q.search, q.category);
    return reply.send({ items });
  });

  app.get("/v1/knowledge/:id", {
    preHandler: authGuard(app.env, "view:knowledge"),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send(await service.getById(getUser(request).orgId, id));
  });
}
