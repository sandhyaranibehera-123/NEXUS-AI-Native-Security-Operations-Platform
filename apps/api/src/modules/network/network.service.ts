import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { networkFlows, dnsQueries } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class NetworkService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listFlows(orgId: string, limit = 50) {
    return withTenant(this.client, orgId, async () => {
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
    return withTenant(this.client, orgId, async () => {
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
}
