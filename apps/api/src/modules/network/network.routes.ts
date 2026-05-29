import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NetworkService } from "./network.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function networkRoutes(app: FastifyInstance) {
  const service = new NetworkService(app.db, app.pgClient);

  app.get("/v1/network/flows", {
    preHandler: authGuard(app.env, "view:network"),
  }, async (request, reply) => {
    const { limit } = z.object({ limit: z.coerce.number().default(50) }).parse(request.query);
    const items = await service.listFlows(getUser(request).orgId, limit);
    return reply.send({ items });
  });

  app.get("/v1/network/dns", {
    preHandler: authGuard(app.env, "view:network"),
  }, async (request, reply) => {
    const { limit } = z.object({ limit: z.coerce.number().default(50) }).parse(request.query);
    const items = await service.listDns(getUser(request).orgId, limit);
    return reply.send({ items });
  });
}
