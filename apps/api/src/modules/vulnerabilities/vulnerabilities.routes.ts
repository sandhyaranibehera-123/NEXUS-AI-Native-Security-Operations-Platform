import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { VulnerabilitiesService } from "./vulnerabilities.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function vulnerabilitiesRoutes(app: FastifyInstance) {
  const service = new VulnerabilitiesService(app.db, app.pgClient);

  app.get("/v1/vulnerabilities", {
    preHandler: authGuard(app.env, "view:vulnerabilities"),
  }, async (request, reply) => {
    const q = z.object({ search: z.string().optional(), limit: z.coerce.number().max(200).default(50) }).parse(request.query);
    const items = await service.list(getUser(request).orgId, q.search, q.limit);
    return reply.send({ items });
  });
}
