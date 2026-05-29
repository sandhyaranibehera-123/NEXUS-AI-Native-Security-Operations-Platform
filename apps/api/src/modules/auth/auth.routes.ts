import type { FastifyInstance } from "fastify";
import { LoginRequestSchema } from "@nexus/shared";
import { AuthService } from "./auth.service.js";
import { authenticate } from "../../middleware/authenticate.js";
import { AppError } from "../../lib/errors.js";

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app.db, app.pgClient, app.env);

  app.post("/v1/auth/login", async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);
    const result = await authService.login(body.email, body.password);
    return reply.send(result);
  });

  app.post("/v1/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) throw new AppError("refreshToken required", 400);
    const result = await authService.refresh(refreshToken);
    return reply.send(result);
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (refreshToken) await authService.logout(refreshToken);
    return reply.send({ ok: true });
  });

  app.get("/v1/auth/me", {
    preHandler: authenticate(app.env),
  }, async (request, reply) => {
    const user = await authService.me(request.user!.sub, request.user!.orgId);
    return reply.send(user);
  });
}
