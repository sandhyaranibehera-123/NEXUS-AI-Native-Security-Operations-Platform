import type { FastifyInstance } from "fastify";
import { CasesService } from "./cases.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function casesRoutes(app: FastifyInstance) {
  const service = new CasesService(app.db, app.pgClient);

  app.get("/v1/cases", {
    preHandler: authGuard(app.env, "view:cases"),
  }, async (request, reply) => {
    const items = await service.list(getUser(request).orgId);
    return reply.send({ items });
  });
}
