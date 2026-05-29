import type { FastifyInstance } from "fastify";
import { CopilotSessionCreateSchema, CopilotMessageCreateSchema } from "@nexus/shared";
import { CopilotService } from "./copilot.service.js";
import { authenticate, requirePermission } from "../../middleware/authenticate.js";

export async function copilotRoutes(app: FastifyInstance) {
  const service = new CopilotService(app.db, app.pgClient, app.env);

  app.post("/v1/copilot/sessions", {
    preHandler: [authenticate(app.env), requirePermission("view:copilot")],
  }, async (request, reply) => {
    const body = CopilotSessionCreateSchema.parse(request.body);
    const session = await service.createSession(request.user!.orgId, request.user!.sub, body);
    return reply.send(session);
  });

  app.get("/v1/copilot/sessions", {
    preHandler: [authenticate(app.env), requirePermission("view:copilot")],
  }, async (request, reply) => {
    const sessions = await service.listSessions(request.user!.orgId, request.user!.sub);
    return reply.send({ items: sessions });
  });

  app.get("/v1/copilot/sessions/:id/messages", {
    preHandler: [authenticate(app.env), requirePermission("view:copilot")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const messages = await service.getMessages(request.user!.orgId, id);
    return reply.send({ items: messages });
  });

  app.post("/v1/copilot/sessions/:id/messages", {
    preHandler: [authenticate(app.env), requirePermission("view:copilot")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = CopilotMessageCreateSchema.parse(request.body);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    try {
      for await (const event of service.streamMessage(
        request.user!.orgId,
        request.user!.sub,
        id,
        body.content,
        body.workflowType,
      )) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      reply.raw.write(`data: ${JSON.stringify({ type: "error", data: String(err) })}\n\n`);
    }
    reply.raw.end();
  });
}
