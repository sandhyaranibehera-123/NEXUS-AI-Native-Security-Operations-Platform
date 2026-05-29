import type { FastifyInstance } from "fastify";
import { CloudService } from "./cloud.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function cloudRoutes(app: FastifyInstance) {
  const service = new CloudService(app.db, app.pgClient);

  app.get("/v1/cloud/accounts", {
    preHandler: authGuard(app.env, "view:cloud"),
  }, async (request, reply) => {
    const items = await service.listAccounts(getUser(request).orgId);
    return reply.send({ items });
  });

  app.get("/v1/cloud/summary", {
    preHandler: authGuard(app.env, "view:cloud"),
  }, async (request, reply) => {
    return reply.send(await service.summary(getUser(request).orgId));
  });
}
