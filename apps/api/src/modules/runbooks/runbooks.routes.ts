import type { FastifyInstance } from "fastify";
import { RunbooksService } from "./runbooks.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function runbooksRoutes(app: FastifyInstance) {
  const service = new RunbooksService(app.db, app.pgClient);

  app.get("/v1/runbooks", {
    preHandler: authGuard(app.env, "view:automation"),
  }, async (request, reply) => {
    const items = await service.list(getUser(request).orgId);
    return reply.send({ items });
  });
}
