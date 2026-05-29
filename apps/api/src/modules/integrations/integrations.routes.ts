import type { FastifyInstance } from "fastify";
import { IntegrationsService } from "./integrations.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function integrationsRoutes(app: FastifyInstance) {
  const service = new IntegrationsService(app.db, app.pgClient);

  app.get("/v1/integrations", {
    preHandler: authGuard(app.env, "manage:integrations"),
  }, async (request, reply) => {
    const items = await service.list(getUser(request).orgId);
    return reply.send({ items });
  });
}
