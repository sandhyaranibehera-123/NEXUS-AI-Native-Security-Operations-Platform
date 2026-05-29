import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DeveloperService } from "./developer.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function developerRoutes(app: FastifyInstance) {
  const service = new DeveloperService(app.db, app.pgClient);

  app.get("/v1/developer/api-keys", {
    preHandler: authGuard(app.env, "view:developer"),
  }, async (request, reply) => {
    const items = await service.listApiKeys(getUser(request).orgId);
    return reply.send({ items });
  });

  app.post("/v1/developer/api-keys", {
    preHandler: authGuard(app.env, "manage:settings"),
  }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1),
      scopes: z.array(z.string()).default(["read:events"]),
    }).parse(request.body);
    const key = await service.createApiKey(getUser(request).orgId, body.name, body.scopes);
    return reply.status(201).send(key);
  });

  app.get("/v1/developer/webhooks", {
    preHandler: authGuard(app.env, "view:developer"),
  }, async (request, reply) => {
    const items = await service.listWebhooks(getUser(request).orgId);
    return reply.send({ items });
  });
}
