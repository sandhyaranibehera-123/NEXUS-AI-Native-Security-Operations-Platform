import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuditService } from "./audit.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function auditRoutes(app: FastifyInstance) {
  const service = new AuditService(app.db, app.pgClient);

  app.get("/v1/audit", {
    preHandler: authGuard(app.env, "view:audit"),
  }, async (request, reply) => {
    const q = z.object({ search: z.string().optional(), limit: z.coerce.number().default(100) }).parse(request.query);
    const items = await service.list(getUser(request).orgId, q.search, q.limit);
    return reply.send({ items });
  });
}
