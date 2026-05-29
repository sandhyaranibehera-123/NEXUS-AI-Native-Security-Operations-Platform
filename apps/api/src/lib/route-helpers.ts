import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate, requirePermission, type JwtPayload } from "../middleware/authenticate.js";
import type { Env } from "../config/env.js";

export function authGuard(env: Env, ...permissions: string[]) {
  const handlers = [authenticate(env)];
  if (permissions.length > 0) {
    handlers.push(requirePermission(...permissions));
  }
  return handlers;
}

export function getUser(request: FastifyRequest): JwtPayload {
  return request.user!;
}

export type AppContext = FastifyInstance;
