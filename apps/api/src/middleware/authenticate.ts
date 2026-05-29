import type { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import type { Env } from "../config/env.js";
import { UnauthorizedError, ForbiddenError } from "./errors.js";

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: string;
  permissions: string[];
  email: string;
  name: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
    requestId?: string;
  }
}

export function signAccessToken(payload: JwtPayload, env: Env): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"] });
}

export function signRefreshToken(userId: string, env: Env): string {
  return jwt.sign({ sub: userId, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string, env: Env): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export function verifyRefreshToken(token: string, env: Env): { sub: string } {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; type?: string };
    if (payload.type !== "refresh") throw new Error("Not a refresh token");
    return payload;
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }
}

export function authenticate(env: Env) {
  return async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing authorization header");
    }
    request.user = verifyAccessToken(header.slice(7), env);
  };
}

export function requirePermission(...perms: string[]) {
  return async (request: FastifyRequest) => {
    const user = request.user;
    if (!user) throw new UnauthorizedError();
    const hasAll = perms.every((p) =>
      user.permissions.includes(p) ||
      user.permissions.includes("*") ||
      user.permissions.some((up) => up.endsWith(":*") && p.startsWith(up.slice(0, -1))),
    );
    if (!hasAll) throw new ForbiddenError(`Missing permission: ${perms.join(", ")}`);
  };
}

export function optionalAuth(env: Env) {
  return async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        request.user = verifyAccessToken(header.slice(7), env);
      } catch {
        // optional — ignore invalid token
      }
    }
  };
}
