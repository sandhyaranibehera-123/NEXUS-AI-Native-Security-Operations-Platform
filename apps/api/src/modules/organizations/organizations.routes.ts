import type { FastifyInstance } from "fastify";
import { OrganizationsService } from "./organizations.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function organizationsRoutes(app: FastifyInstance) {
  const service = new OrganizationsService(app.db);

  app.get("/v1/orgs/current", {
    preHandler: authGuard(app.env),
  }, async (request, reply) => {
    return reply.send(await service.getById(getUser(request).orgId));
  });
}
