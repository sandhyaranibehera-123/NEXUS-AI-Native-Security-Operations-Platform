import type { FastifyInstance } from "fastify";
import { InvestigationsService } from "./investigations.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function investigationsRoutes(app: FastifyInstance) {
  const service = new InvestigationsService(app.db, app.pgClient);

  app.get("/v1/investigations", {
    preHandler: authGuard(app.env, "view:investigations"),
  }, async (request, reply) => {
    const items = await service.list(getUser(request).orgId);
    return reply.send({ items });
  });
}
