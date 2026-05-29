import type { FastifyInstance, FastifyRequest } from "fastify";
import { AuditService } from "../modules/audit/audit.service.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function auditLogPlugin(app: FastifyInstance) {
  const audit = new AuditService(app.db, app.pgClient);

  app.addHook("onResponse", async (request: FastifyRequest, reply) => {
    if (!MUTATION_METHODS.has(request.method)) return;
    if (request.url.startsWith("/v1/auth/login")) return;
    if (reply.statusCode >= 400) return;
    if (!request.user) return;

    const action = `${request.method.toLowerCase()}.${request.url.replace(/^\/v1\//, "").replace(/\//g, ".")}`;
    try {
      await audit.log(request.user.orgId, {
        userId: request.user.sub,
        userEmail: request.user.email,
        action: action.slice(0, 255),
        resourceType: request.url.split("/")[2],
      });
    } catch {
      // audit failure must not break response
    }
  });
}
