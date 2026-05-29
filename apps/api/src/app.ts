import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { createDb, type DbClient } from "@nexus/db";
import type postgres from "postgres";
import { loadEnv, type Env } from "./config/env.js";
import { AppError, ValidationError } from "./lib/errors.js";
import { ZodError } from "zod";
import { registerApiRoutes } from "./modules/register.js";
import { auditLogPlugin } from "./plugins/audit-log.js";

declare module "fastify" {
  interface FastifyInstance {
    env: Env;
    db: DbClient;
    pgClient: postgres.Sql;
  }
}

export async function buildApp() {
  const env = loadEnv();
  const { db, client } = createDb(env.DATABASE_URL);

  const app = Fastify({
    logger: { level: env.NODE_ENV === "production" ? "info" : "debug" },
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 1_048_576,
  });

  app.decorate("env", env);
  app.decorate("db", db);
  app.decorate("pgClient", client);

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: env.RATE_LIMIT_RPM_DEFAULT, timeWindow: "1 minute" });
  await app.register(websocket);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.flatten(),
      });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.details : undefined,
      });
    }
    request.log.error(error);
    return reply.status(500).send({ error: "Internal server error", code: "INTERNAL_ERROR" });
  });

  app.get("/health", async () => ({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_req, reply) => {
    try {
      await client`SELECT 1`;
      let redisOk = true;
      if (env.REDIS_URL && env.NODE_ENV === "production") {
        try {
          const { default: Redis } = await import("ioredis");
          const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
          await redis.ping();
          redis.disconnect();
        } catch {
          redisOk = false;
        }
      }
      if (!redisOk) {
        return reply.status(503).send({ status: "not ready", db: "connected", redis: "disconnected" });
      }
      return { status: "ready", db: "connected", redis: redisOk ? "connected" : "skipped" };
    } catch {
      return reply.status(503).send({ status: "not ready", db: "disconnected" });
    }
  });

  await registerApiRoutes(app);
  await app.register(auditLogPlugin);

  app.addHook("onClose", async () => {
    await client.end();
  });

  return app;
}
