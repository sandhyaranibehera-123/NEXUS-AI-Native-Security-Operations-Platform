import type { FastifyInstance } from "fastify";
import { PlatformHealthService } from "./platform-health.service.js";
import { authGuard } from "../../lib/route-helpers.js";

export async function platformHealthRoutes(app: FastifyInstance) {
  const service = new PlatformHealthService(app.db);

  app.get("/v1/health/platform", {
    preHandler: authGuard(app.env, "view:platform-health"),
  }, async (_request, reply) => {
    return reply.send(await service.getStatus());
  });

  app.get("/v1/health/status", {
    preHandler: authGuard(app.env, "view:status"),
  }, async (_request, reply) => {
    return reply.send(await service.getStatus());
  });
}
