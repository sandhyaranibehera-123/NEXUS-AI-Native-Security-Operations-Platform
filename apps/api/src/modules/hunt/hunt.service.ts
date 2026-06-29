import type postgres from "postgres";
import type { DbClient } from "@nexus/db";
import { and, desc, eq, gte, ilike, or, sql, count, type SQL } from "drizzle-orm";
import { securityEvents, huntQueries } from "@nexus/db/schema";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export interface HuntQueryDto {
  id: string;
  name: string;
  description: string;
  query: string;
  frequency: string;
  lastRun: string;
  hits: number;
  severity: "critical" | "high" | "medium" | "info";
}

export interface HuntAnomalyDto {
  id: string;
  type: string;
  description: string;
  baseline: number;
  observed: number;
  deviation: number;
  assets: string[];
  severity: "critical" | "high" | "medium";
  confidence: number;
}

export interface HuntResultDto {
  time: string;
  src: string;
  dst: string;
  bytes: string;
  proto: string;
}

function mapHuntQuery(r: typeof huntQueries.$inferSelect): HuntQueryDto {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    query: r.query,
    frequency: r.scheduleMinutes ? `${r.scheduleMinutes}m` : "manual",
    lastRun: r.lastRunAt?.toISOString() ?? "",
    hits: r.lastHitCount ?? 0,
    severity: (r.severity as HuntQueryDto["severity"]) ?? "medium",
  };
}

/**
 * Parse a lightweight hunt query into structured filters. Supports
 * `field:value` tokens (severity, type, host, user, ip, src, dst, proto) and
 * falls back to free-text matching across message/host/ip fields.
 */
function parseHuntQuery(query: string) {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const filters: { field: string; value: string }[] = [];
  const freeText: string[] = [];
  const FIELDS = new Set(["severity", "type", "host", "user", "ip", "src", "dst", "proto", "domain"]);
  for (const token of tokens) {
    const m = token.match(/^([a-z_]+):(.+)$/i);
    if (m && FIELDS.has(m[1].toLowerCase())) {
      filters.push({ field: m[1].toLowerCase(), value: m[2].replace(/^['"]|['"]$/g, "") });
    } else if (!token.includes(":") || !/^[a-z_]+:/i.test(token)) {
      freeText.push(token);
    }
  }
  return { filters, freeText };
}

export class HuntService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listQueries(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(huntQueries)
        .where(eq(huntQueries.organizationId, orgId))
        .orderBy(desc(huntQueries.createdAt));
      return rows.map(mapHuntQuery);
    });
  }

  async createQuery(orgId: string, userId: string, data: {
    name: string;
    description?: string;
    query: string;
    severity?: string;
    scheduleMinutes?: number;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(huntQueries).values({
        organizationId: orgId,
        createdBy: userId,
        name: data.name,
        description: data.description ?? null,
        query: data.query,
        severity: data.severity ?? "medium",
        scheduleMinutes: data.scheduleMinutes ?? null,
        isEnabled: true,
      }).returning();
      return mapHuntQuery(row);
    });
  }

  async updateQuery(orgId: string, id: string, data: {
    name?: string;
    description?: string;
    query?: string;
    severity?: string;
    scheduleMinutes?: number | null;
    isEnabled?: boolean;
  }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof huntQueries.$inferInsert> = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.query !== undefined) updates.query = data.query;
      if (data.severity !== undefined) updates.severity = data.severity;
      if (data.scheduleMinutes !== undefined) updates.scheduleMinutes = data.scheduleMinutes;
      if (data.isEnabled !== undefined) updates.isEnabled = data.isEnabled;

      const [row] = await this.db
        .update(huntQueries)
        .set(updates)
        .where(and(eq(huntQueries.id, id), eq(huntQueries.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Hunt query not found");
      return mapHuntQuery(row);
    });
  }

  async deleteQuery(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(huntQueries)
        .where(and(eq(huntQueries.id, id), eq(huntQueries.organizationId, orgId)));
    });
  }

  /** Runs a saved query against live telemetry and records the hit count. */
  async runQuery(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [saved] = await this.db
        .select()
        .from(huntQueries)
        .where(and(eq(huntQueries.id, id), eq(huntQueries.organizationId, orgId)))
        .limit(1);
      if (!saved) throw new NotFoundError("Hunt query not found");

      const result = await this.executeQuery(orgId, saved.query, 25, 0);

      const [updated] = await this.db
        .update(huntQueries)
        .set({ lastRunAt: new Date(), lastHitCount: result.total })
        .where(eq(huntQueries.id, id))
        .returning();

      return { query: mapHuntQuery(updated), result };
    });
  }

  /**
   * Real anomaly detection: for each (event type, severity) pair seen in the
   * last 25 hours, compares the most recent hourly bucket ("observed")
   * against the mean of the preceding hourly buckets ("baseline"). Flags
   * pairs with both a meaningful relative jump and a minimum volume, so a
   * single rare event doesn't read as a 100% spike.
   */
  async listAnomalies(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const since = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const bucketExpr = sql<Date>`date_trunc('hour', ${securityEvents.eventTimestamp})`;

      const rows = await this.db
        .select({
          type: securityEvents.type,
          severity: securityEvents.severity,
          bucket: bucketExpr,
          cnt: count(),
        })
        .from(securityEvents)
        .where(and(eq(securityEvents.organizationId, orgId), gte(securityEvents.eventTimestamp, since)))
        .groupBy(securityEvents.type, securityEvents.severity, bucketExpr);

      const byKey = new Map<string, { type: string; severity: string; buckets: { bucket: Date; cnt: number }[] }>();
      for (const row of rows) {
        const key = `${row.type}::${row.severity}`;
        const entry = byKey.get(key) ?? { type: row.type, severity: row.severity, buckets: [] };
        entry.buckets.push({ bucket: row.bucket, cnt: row.cnt });
        byKey.set(key, entry);
      }

      const anomalies: HuntAnomalyDto[] = [];
      for (const { type, severity, buckets } of byKey.values()) {
        if (buckets.length < 2) continue; // not enough history to baseline against
        buckets.sort((a, b) => a.bucket.getTime() - b.bucket.getTime());
        const latest = buckets[buckets.length - 1];
        const historical = buckets.slice(0, -1);
        const baseline = historical.reduce((sum, b) => sum + b.cnt, 0) / historical.length;
        const observed = latest.cnt;
        if (observed < 3) continue; // ignore low-volume noise
        const deviation = baseline > 0 ? ((observed - baseline) / baseline) * 100 : observed * 100;
        if (deviation < 200) continue; // require at least a 2x jump over baseline

        anomalies.push({
          id: `anomaly-${type}-${severity}-${latest.bucket.getTime()}`,
          type: `${type} volume`,
          description: `${type} events at ${severity} severity spiked to ${observed}/hr vs a ${Math.round(baseline)}/hr baseline`,
          baseline: Math.round(baseline),
          observed,
          deviation: Math.round(deviation),
          assets: [],
          severity: severity === "critical" ? "critical" : severity === "high" ? "high" : "medium",
          confidence: Math.min(0.95, 0.5 + historical.length * 0.02),
        });
      }

      return anomalies.sort((a, b) => b.deviation - a.deviation).slice(0, 20);
    });
  }

  /**
   * Execute a hunt query against live security-event telemetry.
   * Returns matched rows plus the total match count for pagination.
   */
  async executeQuery(
    orgId: string,
    query: string,
    limit = 25,
    offset = 0,
  ): Promise<{ items: HuntResultDto[]; total: number }> {
    return withTenant(this.db, orgId, async () => {
      const { filters, freeText } = parseHuntQuery(query ?? "");
      const conditions: SQL[] = [eq(securityEvents.organizationId, orgId)];

      for (const { field, value } of filters) {
        const like = `%${value}%`;
        switch (field) {
          case "severity":
            conditions.push(eq(securityEvents.severity, value.toLowerCase()));
            break;
          case "type":
            conditions.push(ilike(securityEvents.type, like));
            break;
          case "host":
            conditions.push(ilike(securityEvents.host, like));
            break;
          case "user":
            conditions.push(ilike(securityEvents.username, like));
            break;
          case "proto":
          case "domain":
            conditions.push(ilike(securityEvents.message, like));
            break;
          case "src":
            conditions.push(ilike(securityEvents.sourceIp, like));
            break;
          case "dst":
            conditions.push(ilike(securityEvents.destIp, like));
            break;
          case "ip":
            conditions.push(or(
              ilike(securityEvents.sourceIp, like),
              ilike(securityEvents.destIp, like),
            )!);
            break;
        }
      }

      for (const term of freeText) {
        const like = `%${term}%`;
        conditions.push(or(
          ilike(securityEvents.message, like),
          ilike(securityEvents.host, like),
          ilike(securityEvents.sourceIp, like),
          ilike(securityEvents.destIp, like),
          ilike(securityEvents.username, like),
          ilike(securityEvents.type, like),
        )!);
      }

      const whereClause = and(...conditions);

      const [totalRow] = await this.db
        .select({ value: count() })
        .from(securityEvents)
        .where(whereClause);

      const rows = await this.db
        .select()
        .from(securityEvents)
        .where(whereClause)
        .orderBy(desc(securityEvents.eventTimestamp))
        .limit(limit)
        .offset(offset);

      return {
        total: totalRow?.value ?? 0,
        items: rows.map((row) => {
          const raw = (row.rawData as Record<string, unknown>) ?? {};
          const bytes = raw.bytes ?? raw.bytesOut ?? raw.bytes_out;
          const proto = raw.protocol ?? raw.proto ?? row.type;
          return {
            time: row.eventTimestamp.toISOString(),
            src: row.sourceIp ?? row.host ?? "—",
            dst: row.destIp ?? row.asset ?? "—",
            bytes: bytes != null ? String(bytes) : "—",
            proto: String(proto),
          };
        }),
      };
    });
  }
}
