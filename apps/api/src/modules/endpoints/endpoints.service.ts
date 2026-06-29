import { eq, and, desc, ilike } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { endpoints, endpointMalwareIndicators, endpointProcesses, endpointNetworkConnections } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

function severityToScore(severity: string | null): number {
  switch (severity) {
    case "critical": return 95;
    case "high": return 80;
    case "medium": return 55;
    default: return 30;
  }
}

export class EndpointsService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, search?: string, limit = 50) {
    return withTenant(this.db, orgId, async () => {
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
    return withTenant(this.db, orgId, async () => {
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
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .update(endpoints)
        .set({ isIsolated: true, status: "isolated", isolatedAt: new Date() })
        .where(and(eq(endpoints.id, id), eq(endpoints.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Endpoint not found");
      return mapEndpoint(row);
    });
  }

  async unisolate(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .update(endpoints)
        .set({ isIsolated: false, status: "healthy", isolatedAt: null, isolatedBy: null })
        .where(and(eq(endpoints.id, id), eq(endpoints.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Endpoint not found");
      return mapEndpoint(row);
    });
  }

  /**
   * Synchronous on-demand rescan: recomputes risk scores from currently
   * persisted malware indicators. There is no live agent integration, so this
   * reflects existing telemetry rather than generating new findings.
   */
  async scan(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [ep] = await this.db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.organizationId, orgId)))
        .limit(1);
      if (!ep) throw new NotFoundError("Endpoint not found");

      const indicators = await this.db
        .select()
        .from(endpointMalwareIndicators)
        .where(eq(endpointMalwareIndicators.endpointId, id));
      const active = indicators.filter((i) => !i.quarantined);

      const riskMalware = active.length === 0
        ? 0
        : Math.round(active.reduce((sum, i) => sum + severityToScore(i.severity), 0) / active.length);
      const riskOverall = Math.round((riskMalware + (ep.riskNetwork ?? 0) + (ep.riskCredential ?? 0) + (ep.riskBehavior ?? 0)) / 4);

      const [updated] = await this.db
        .update(endpoints)
        .set({ riskMalware, riskOverall, lastCheckIn: new Date(), updatedAt: new Date() })
        .where(and(eq(endpoints.id, id), eq(endpoints.organizationId, orgId)))
        .returning();

      return {
        ...mapEndpoint(updated!),
        scanSummary: {
          indicatorsFound: indicators.length,
          activeThreats: active.length,
          quarantined: indicators.length - active.length,
          scannedAt: new Date().toISOString(),
        },
      };
    });
  }

  async getProcesses(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const owned = await this.#isOwned(orgId, id);
      if (!owned) return null;

      const rows = await this.db
        .select()
        .from(endpointProcesses)
        .where(eq(endpointProcesses.endpointId, id))
        .orderBy(desc(endpointProcesses.startedAt))
        .limit(100);

      return rows.map((p) => ({
        id: p.id,
        pid: p.pid,
        parentPid: p.parentPid,
        name: p.processName,
        path: p.processPath,
        commandLine: p.commandLine,
        user: p.username,
        hashSha256: p.hashSha256,
        isSigned: p.isSigned,
        signer: p.signer,
        isElevated: p.isElevated ?? false,
        isMalicious: p.isMalicious ?? false,
        startedAt: p.startedAt?.toISOString() ?? null,
        endedAt: p.endedAt?.toISOString() ?? null,
      }));
    });
  }

  async getNetworkConnections(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const owned = await this.#isOwned(orgId, id);
      if (!owned) return null;

      const rows = await this.db
        .select()
        .from(endpointNetworkConnections)
        .where(eq(endpointNetworkConnections.endpointId, id))
        .orderBy(desc(endpointNetworkConnections.connectionAt))
        .limit(100);

      return rows.map((c) => ({
        id: c.id,
        direction: c.direction,
        protocol: c.protocol,
        localIp: c.localIp,
        localPort: c.localPort,
        remoteIp: c.remoteIp,
        remotePort: c.remotePort,
        remoteHost: c.remoteHost,
        bytesSent: c.bytesSent ?? 0,
        bytesRecv: c.bytesRecv ?? 0,
        isMalicious: c.isMalicious ?? false,
        iocMatched: c.iocMatched,
        connectionAt: c.connectionAt?.toISOString() ?? null,
      }));
    });
  }

  async #isOwned(orgId: string, id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: endpoints.id })
      .from(endpoints)
      .where(and(eq(endpoints.id, id), eq(endpoints.organizationId, orgId)))
      .limit(1);
    return !!row;
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
