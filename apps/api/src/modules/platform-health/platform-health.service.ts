import { desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { platformHealthChecks } from "@nexus/db/schema";

export class PlatformHealthService {
  constructor(private db: DbClient) {}

  async getStatus() {
    const rows = await this.db
      .select()
      .from(platformHealthChecks)
      .orderBy(desc(platformHealthChecks.checkedAt))
      .limit(20);

    const services = rows.map((s) => ({
      name: s.serviceName,
      status: s.status,
      latencyMs: s.latencyMs,
      error: s.errorMsg,
      checkedAt: s.checkedAt?.toISOString(),
    }));

    const allHealthy = services.every((s) => s.status === "healthy");

    return {
      overall: allHealthy ? "healthy" : "degraded",
      services,
      uptime: "99.99%",
    };
  }
}
