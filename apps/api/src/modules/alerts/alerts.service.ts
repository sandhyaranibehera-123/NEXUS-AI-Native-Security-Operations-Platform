import { eq, and, desc, lt, sql, count } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { alerts } from "@nexus/db/schema";
import type postgres from "postgres";
import type { AlertListQuery } from "@nexus/shared";
import { withTenant } from "../../lib/tenant.js";

export class AlertsService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
  ) {}

  async list(orgId: string, query: AlertListQuery) {
    return withTenant(this.client, orgId, async () => {
      const conditions = [eq(alerts.organizationId, orgId)];

      if (query.severity?.length) {
        conditions.push(sql`${alerts.severity} = ANY(${query.severity})`);
      }
      if (query.status?.length) {
        conditions.push(sql`${alerts.status} = ANY(${query.status})`);
      }
      if (query.cursor) {
        conditions.push(lt(alerts.id, query.cursor));
      }

      const rows = await this.db
        .select()
        .from(alerts)
        .where(and(...conditions))
        .orderBy(desc(alerts.aiPriorityScore), desc(alerts.createdAt))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      const items = hasMore ? rows.slice(0, query.limit) : rows;

      return {
        items: items.map(mapAlert),
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };
    });
  }

  async countCritical(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const [result] = await this.db
        .select({ count: count() })
        .from(alerts)
        .where(and(
          eq(alerts.organizationId, orgId),
          sql`${alerts.severity} IN ('critical', 'high')`,
          sql`${alerts.status} IN ('new', 'triaging', 'escalated')`,
        ));
      return result?.count ?? 0;
    });
  }

  async acknowledge(orgId: string, id: string) {
    return withTenant(this.client, orgId, async () => {
      const [row] = await this.db
        .update(alerts)
        .set({ isAcknowledged: true, status: "acknowledged", updatedAt: new Date() })
        .where(and(eq(alerts.id, id), eq(alerts.organizationId, orgId)))
        .returning();
      return row ? mapAlert(row) : null;
    });
  }
}

function mapAlert(row: typeof alerts.$inferSelect) {
  return {
    id: row.id,
    rule: row.title,
    severity: row.severity,
    source: "Detection Engine",
    owner: null,
    aiPriorityScore: row.aiPriorityScore ?? 0,
    dedupCount: row.dedupCount ?? 1,
    escalated: row.isEscalated ?? false,
    acknowledged: row.isAcknowledged ?? false,
    suppressed: row.isSuppressed ?? false,
    createdAt: row.createdAt!.toISOString(),
    updatedAt: row.updatedAt!.toISOString(),
    description: row.description,
    raw: (row.rawTriggerData as Record<string, unknown>) ?? {},
  };
}

export { mapAlert };
