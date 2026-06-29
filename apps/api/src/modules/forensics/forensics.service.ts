import { eq, and, desc } from "drizzle-orm";
import type postgres from "postgres";
import type { DbClient } from "@nexus/db";
import { endpoints, endpointProcesses, endpointNetworkConnections, endpointMalwareIndicators } from "@nexus/db/schema";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export interface ForensicsProcessDto {
  pid: number;
  name: string;
  ppid: number;
  cmdline: string;
  user: string;
  start: string;
  severity: "critical" | "high" | "medium" | "info";
}

export interface ForensicsFileEventDto {
  time: string;
  action: string;
  path: string;
  hash: string;
  size: string;
  severity: "critical" | "high" | "medium" | "info";
}

export interface ForensicsBinaryDto {
  name: string;
  hash: string;
  type: string;
  detection: string;
  score: number;
  severity: "critical" | "high" | "medium" | "info";
}

export interface ForensicsArtifactDto {
  type: string;
  detail: string;
  pid: number;
}

export interface ForensicsDto {
  fileEvents: ForensicsFileEventDto[];
  processTree: ForensicsProcessDto[];
  binaries: ForensicsBinaryDto[];
  artifacts: ForensicsArtifactDto[];
}

function severityFromMalwareFlags(isMalicious: boolean | null, isElevated: boolean | null): ForensicsProcessDto["severity"] {
  if (isMalicious) return "critical";
  if (isElevated) return "high";
  return "info";
}

function severityToScore(severity: string | null): number {
  switch (severity) {
    case "critical": return 95;
    case "high": return 80;
    case "medium": return 55;
    default: return 30;
  }
}

export class ForensicsService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async getForensicsData(orgId: string, endpointId: string): Promise<ForensicsDto> {
    return withTenant(this.db, orgId, async () => {
      const [endpoint] = await this.db
        .select({ id: endpoints.id })
        .from(endpoints)
        .where(and(eq(endpoints.id, endpointId), eq(endpoints.organizationId, orgId)))
        .limit(1);
      if (!endpoint) throw new NotFoundError("Endpoint not found");

      const [processes, indicators, connections] = await Promise.all([
        this.db
          .select()
          .from(endpointProcesses)
          .where(eq(endpointProcesses.endpointId, endpointId))
          .orderBy(desc(endpointProcesses.startedAt))
          .limit(50),
        this.db
          .select()
          .from(endpointMalwareIndicators)
          .where(eq(endpointMalwareIndicators.endpointId, endpointId))
          .orderBy(desc(endpointMalwareIndicators.detectedAt))
          .limit(50),
        this.db
          .select({
            id: endpointNetworkConnections.id,
            direction: endpointNetworkConnections.direction,
            protocol: endpointNetworkConnections.protocol,
            localIp: endpointNetworkConnections.localIp,
            localPort: endpointNetworkConnections.localPort,
            remoteIp: endpointNetworkConnections.remoteIp,
            remotePort: endpointNetworkConnections.remotePort,
            remoteHost: endpointNetworkConnections.remoteHost,
            isMalicious: endpointNetworkConnections.isMalicious,
            iocMatched: endpointNetworkConnections.iocMatched,
            connectionAt: endpointNetworkConnections.connectionAt,
            processPid: endpointProcesses.pid,
          })
          .from(endpointNetworkConnections)
          .leftJoin(endpointProcesses, eq(endpointNetworkConnections.processId, endpointProcesses.id))
          .where(eq(endpointNetworkConnections.endpointId, endpointId))
          .orderBy(desc(endpointNetworkConnections.connectionAt))
          .limit(50),
      ]);

      return {
        // No file-system event collector is wired yet — report real (empty) state
        // rather than synthesizing entries.
        fileEvents: [],
        processTree: processes.map((p) => ({
          pid: p.pid ?? 0,
          name: p.processName,
          ppid: p.parentPid ?? 0,
          cmdline: p.commandLine ?? "",
          user: p.username ?? "—",
          start: p.startedAt?.toISOString() ?? "",
          severity: severityFromMalwareFlags(p.isMalicious, p.isElevated),
        })),
        binaries: indicators.map((i) => ({
          name: i.description || i.indicator,
          hash: i.indicator,
          type: i.indicatorType,
          detection: i.description || `${i.indicatorType} indicator`,
          score: severityToScore(i.severity),
          severity: (i.severity as ForensicsBinaryDto["severity"]) ?? "high",
        })),
        artifacts: connections.map((c) => ({
          type: "Network Socket",
          detail: [
            c.protocol ?? "TCP",
            c.direction ? `${c.direction.toUpperCase()}` : null,
            `${c.localIp ?? "?"}:${c.localPort ?? "?"} -> ${c.remoteIp ?? c.remoteHost ?? "?"}:${c.remotePort ?? "?"}`,
            c.iocMatched ? `(matched IOC: ${c.iocMatched})` : c.isMalicious ? "(flagged malicious)" : null,
          ].filter(Boolean).join(" "),
          pid: c.processPid ?? 0,
        })),
      };
    });
  }
}
