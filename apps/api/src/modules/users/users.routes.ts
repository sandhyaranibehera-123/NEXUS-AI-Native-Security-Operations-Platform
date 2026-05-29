import type { FastifyInstance } from "fastify";
import { UsersService } from "./users.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function usersRoutes(app: FastifyInstance) {
  const service = new UsersService(app.db, app.pgClient);

  app.get("/v1/users", {
    preHandler: authGuard(app.env, "manage:org"),
  }, async (request, reply) => {
    const items = await service.list(getUser(request).orgId);
    return reply.send({ items });
  });

  app.get("/v1/users/identity-anomalies", {
    preHandler: authGuard(app.env, "view:identity"),
  }, async (request, reply) => {
    const items = await service.listIdentityAnomalies(getUser(request).orgId);
    return reply.send({ items });
  });
}
