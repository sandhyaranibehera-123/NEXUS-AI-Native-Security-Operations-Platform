import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { notifications } from "@nexus/db/schema";
import { withTenant } from "../../lib/tenant.js";
import { authGuard, getUser } from "../../lib/route-helpers.js";

export async function notificationsRoutes(app: FastifyInstance) {
  app.get("/v1/notifications", {
    preHandler: authGuard(app.env, "view:notifications"),
  }, async (request, reply) => {
    const orgId = getUser(request).orgId;
    const userId = getUser(request).sub;

    const items = await withTenant(app.pgClient, orgId, async () => {
      return app.db
        .select()
        .from(notifications)
        .where(and(eq(notifications.organizationId, orgId), eq(notifications.userId, userId)))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    });

    return reply.send({
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        severity: n.severity,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt?.toISOString(),
      })),
    });
  });

  app.patch("/v1/notifications/:id/read", {
    preHandler: authGuard(app.env, "view:notifications"),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await withTenant(app.pgClient, getUser(request).orgId, async () => {
      await app.db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(eq(notifications.id, id));
    });
    return reply.send({ ok: true });
  });
}
