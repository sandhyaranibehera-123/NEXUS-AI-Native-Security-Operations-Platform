import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { networkFlows, dnsQueries } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export class NetworkService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listFlows(orgId: string, limit = 50) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(networkFlows)
        .where(eq(networkFlows.organizationId, orgId))
        .orderBy(desc(networkFlows.flowStart))
        .limit(limit);

      return rows.map((f) => ({
        id: f.id,
        sourceIp: f.sourceIp,
        destinationIp: f.destinationIp,
        sourcePort: f.sourcePort,
        destinationPort: f.destinationPort,
        protocol: f.protocol,
        bytes: f.bytesTotal,
        isMalicious: f.isMalicious,
        threatCategory: f.threatCategory,
        geoSrc: f.geoCountrySrc,
        geoDst: f.geoCountryDst,
        flowStart: f.flowStart.toISOString(),
      }));
    });
  }

  async listDns(orgId: string, limit = 50) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(dnsQueries)
        .where(eq(dnsQueries.organizationId, orgId))
        .orderBy(desc(dnsQueries.queriedAt))
        .limit(limit);

      return rows.map((d) => ({
        id: d.id,
        domain: d.queryDomain,
        type: d.queryType,
        entropy: Number(d.entropyScore ?? 0),
        isDga: d.isDga,
        isBlocklisted: d.isBlocklisted,
        threatCategory: d.threatCategory,
        queriedAt: d.queriedAt?.toISOString(),
      }));
    });
  }

  async markFlowMalicious(orgId: string, id: string, isMalicious: boolean, threatCategory?: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .update(networkFlows)
        .set({ isMalicious, threatCategory: threatCategory ?? (isMalicious ? "manually-flagged" : null) })
        .where(and(eq(networkFlows.id, id), eq(networkFlows.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Network flow not found");

      return {
        id: row.id,
        sourceIp: row.sourceIp,
        destinationIp: row.destinationIp,
        isMalicious: row.isMalicious,
        threatCategory: row.threatCategory,
      };
    });
  }
}
