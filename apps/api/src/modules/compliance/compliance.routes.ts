import type { FastifyInstance } from "fastify";
import { ComplianceService } from "./compliance.service.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function complianceRoutes(app: FastifyInstance) {
  const service = new ComplianceService(app.db, app.pgClient);

  app.get("/v1/compliance/assessments", {
    preHandler: authGuard(app.env, "view:compliance"),
  }, async (request, reply) => {
    const items = await service.listAssessments(getUser(request).orgId);
    return reply.send({ items });
  });
}
