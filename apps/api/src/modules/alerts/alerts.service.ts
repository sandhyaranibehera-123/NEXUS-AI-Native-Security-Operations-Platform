import { eq, and, desc, lt, sql, count } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { alerts, incidents, incidentTimeline, incidentRecommendations } from "@nexus/db/schema";
import type postgres from "postgres";
import type { AlertListQuery } from "@nexus/shared";
import { withTenant } from "../../lib/tenant.js";

export class AlertsService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
  ) {}

  async list(orgId: string, query: AlertListQuery) {
    return withTenant(this.db, orgId, async () => {
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
    return withTenant(this.db, orgId, async () => {
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
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .update(alerts)
        .set({ isAcknowledged: true, status: "acknowledged", updatedAt: new Date() })
        .where(and(eq(alerts.id, id), eq(alerts.organizationId, orgId)))
        .returning();
      return row ? mapAlert(row) : null;
    });
  }

  async suppressSimilar(orgId: string, id: string, actorName: string, reason?: string) {
    return withTenant(this.db, orgId, async () => {
      const [source] = await this.db
        .select()
        .from(alerts)
        .where(and(eq(alerts.id, id), eq(alerts.organizationId, orgId)))
        .limit(1);

      if (!source) return null;

      const rows = await this.db
        .update(alerts)
        .set({ isSuppressed: true, status: "suppressed", updatedAt: new Date() })
        .where(and(
          eq(alerts.organizationId, orgId),
          eq(alerts.title, source.title),
          eq(alerts.severity, source.severity),
        ))
        .returning();

      return {
        source: mapAlert(source),
        suppressedCount: rows.length,
        reason: reason || `Suppressed similar alerts by ${actorName}`,
      };
    });
  }

  async createIncidentFromAlert(orgId: string, id: string, actorName: string, body?: { title?: string; category?: string }) {
    return withTenant(this.db, orgId, async () => {
      const [alert] = await this.db
        .select()
        .from(alerts)
        .where(and(eq(alerts.id, id), eq(alerts.organizationId, orgId)))
        .limit(1);

      if (!alert) return null;

      const incidentCode = `INC-${Date.now().toString().slice(-6)}`;
      const [incident] = await this.db.insert(incidents).values({
        organizationId: orgId,
        incidentCode,
        title: body?.title || alert.title,
        description: alert.description || `Incident opened from alert ${alert.id}`,
        severity: alert.severity,
        status: "investigating",
        category: body?.category || "alert-escalation",
        affectedAssetsCount: 1,
        affectedUsersCount: 0,
        summary: alert.description || `Alert ${alert.title} was escalated for response.`,
        rootCauseAnalysis: "Pending analyst validation.",
      }).returning();

      await this.db.insert(incidentTimeline).values({
        incidentId: incident.id,
        timestamp: new Date(),
        actorType: "user",
        actorName,
        actionType: "incident_created",
        description: `Created from alert ${alert.id}`,
      });

      await this.db.insert(incidentRecommendations).values([
        {
          incidentId: incident.id,
          orderIndex: 1,
          content: "Validate affected assets and confirm alert fidelity.",
        },
        {
          incidentId: incident.id,
          orderIndex: 2,
          content: "Collect related events, endpoint telemetry, and network flows.",
        },
        {
          incidentId: incident.id,
          orderIndex: 3,
          content: "Assign response owner and start containment if impact is confirmed.",
        },
      ]);

      await this.db
        .update(alerts)
        .set({ isEscalated: true, status: "escalated", updatedAt: new Date() })
        .where(eq(alerts.id, id));

      return {
        id: incident.id,
        code: incident.incidentCode,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        openedAt: incident.openedAt?.toISOString(),
      };
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
