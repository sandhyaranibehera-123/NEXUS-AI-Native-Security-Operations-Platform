import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ThreatIntelService } from "./threat-intel.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function threatIntelRoutes(app: FastifyInstance) {
  const service = new ThreatIntelService(app.db, app.pgClient);

  app.get("/v1/threat-intel/actors", {
    preHandler: authGuard(app.env, "view:threat-intel"),
  }, async (request, reply) => {
    const q = z.object({ search: z.string().optional(), limit: z.coerce.number().default(30) }).parse(request.query);
    const items = await service.listActors(q.search, q.limit);
    return reply.send({ items });
  });

  app.get("/v1/threat-intel/iocs", {
    preHandler: authGuard(app.env, "view:threat-intel"),
  }, async (request, reply) => {
    const items = await service.listIocs(getUser(request).orgId);
    return reply.send({ items });
  });
}
