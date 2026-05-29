import { eq, and, desc, ilike } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { endpoints, endpointMalwareIndicators } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export class EndpointsService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, search?: string, limit = 50) {
    return withTenant(this.client, orgId, async () => {
      const conditions = [eq(endpoints.organizationId, orgId)];
      if (search) conditions.push(ilike(endpoints.hostname, `%${search}%`));

      const rows = await this.db
        .select()
        .from(endpoints)
        .where(and(...conditions))
        .orderBy(desc(endpoints.riskOverall))
        .limit(limit);

      return rows.map(mapEndpoint);
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.client, orgId, async () => {
      const [row] = await this.db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.organizationId, orgId)))
        .limit(1);
      if (!row) return null;

      const indicators = await this.db
        .select()
        .from(endpointMalwareIndicators)
        .where(eq(endpointMalwareIndicators.endpointId, id));

      return {
        ...mapEndpoint(row),
        malwareIndicators: indicators.map((i) => i.indicator),
      };
    });
  }

  async isolate(orgId: string, id: string) {
    return withTenant(this.client, orgId, async () => {
      const [row] = await this.db
        .update(endpoints)
        .set({ isIsolated: true, status: "isolated" })
        .where(and(eq(endpoints.id, id), eq(endpoints.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Endpoint not found");
      return mapEndpoint(row);
    });
  }
}

function mapEndpoint(row: typeof endpoints.$inferSelect) {
  const status = row.isIsolated ? "quarantined" : row.status === "offline" ? "offline" : "online";
  return {
    id: row.id,
    hostname: row.hostname,
    os: row.osVersion ? `${row.os} ${row.osVersion}` : row.os,
    osType: row.os,
    user: "—",
    agentVersion: row.agentVersion ?? "—",
    riskScore: row.riskOverall ?? 0,
    riskScoreBreakdown: {
      overall: row.riskOverall ?? 0,
      malware: row.riskMalware ?? 0,
      network: row.riskNetwork ?? 0,
      credential: row.riskCredential ?? 0,
      behavior: row.riskBehavior ?? 0,
    },
    status,
    isolated: row.isIsolated ?? false,
    ip: row.ipAddress,
    tags: (row.tags as string[]) ?? [],
    lastCheckIn: row.lastCheckIn?.toISOString() ?? new Date().toISOString(),
    sessionCount: row.sessionCount ?? 0,
    malwareIndicators: [] as string[],
  };
}
