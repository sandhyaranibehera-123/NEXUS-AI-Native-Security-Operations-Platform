import type { FastifyInstance } from "fastify";
import { EventsService } from "../events/events.service.js";
import { verifyAccessToken } from "../../middleware/authenticate.js";

export async function websocketRoutes(app: FastifyInstance) {
  const eventsService = new EventsService(app.db, app.pgClient);

  app.get("/v1/ws/events", { websocket: true }, (socket, request) => {
    const url = new URL(request.url, "http://localhost");
    const token = url.searchParams.get("token");
    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    let orgId: string;
    try {
      const user = verifyAccessToken(token, app.env);
      orgId = user.orgId;
    } catch {
      socket.close(4001, "Invalid token");
      return;
    }

    let since = new Date();
    const interval = setInterval(async () => {
      try {
        const result = await eventsService.list(orgId, {
          since: since.toISOString(),
          limit: 10,
        });
        for (const event of result.items) {
          socket.send(JSON.stringify({ type: "event", data: event }));
        }
        if (result.items.length > 0) {
          since = new Date(result.items[0].timestamp);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    socket.on("close", () => clearInterval(interval));
    socket.send(JSON.stringify({ type: "connected", data: { orgId } }));
  });
}
