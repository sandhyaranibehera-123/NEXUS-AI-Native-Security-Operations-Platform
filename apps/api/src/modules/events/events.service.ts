import { eq, and, desc, lt, gte, ilike, or, sql, count } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import {
  investigationNotebooks,
  securityEvents,
  incidents,
  incidentTimeline,
  incidentRecommendations,
  alertSuppressionRules,
  auditLogs,
} from "@nexus/db/schema";
import type postgres from "postgres";
import type { SecurityEventListQuery } from "@nexus/shared";
import { withTenant } from "../../lib/tenant.js";

export class EventsService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
  ) {}

  async list(orgId: string, query: SecurityEventListQuery) {
    return withTenant(this.db, orgId, async () => {
      const conditions = [eq(securityEvents.organizationId, orgId)];

      if (query.severity?.length) {
        conditions.push(sql`${securityEvents.severity} = ANY(${query.severity})`);
      }
      if (query.type?.length) {
        conditions.push(sql`${securityEvents.type} = ANY(${query.type})`);
      }
      if (query.from) {
        conditions.push(gte(securityEvents.eventTimestamp, new Date(query.from)));
      }
      if (query.to) {
        conditions.push(lt(securityEvents.eventTimestamp, new Date(query.to)));
      }
      if (query.since) {
        conditions.push(gte(securityEvents.eventTimestamp, new Date(query.since)));
      }
      if (query.search) {
        const term = `%${query.search}%`;
        conditions.push(or(
          ilike(securityEvents.message, term),
          ilike(securityEvents.username, term),
          ilike(securityEvents.host, term),
          ilike(securityEvents.sourceIp, term),
        )!);
      }
      if (query.cursor) {
        conditions.push(lt(securityEvents.id, query.cursor));
      }

      const rows = await this.db
        .select()
        .from(securityEvents)
        .where(and(...conditions))
        .orderBy(desc(securityEvents.eventTimestamp))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      const items = hasMore ? rows.slice(0, query.limit) : rows;

      return {
        items: items.map(mapEvent),
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .select()
        .from(securityEvents)
        .where(and(eq(securityEvents.id, id), eq(securityEvents.organizationId, orgId)))
        .limit(1);
      return row ? mapEvent(row) : null;
    });
  }

  async countLast24h(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [result] = await this.db
        .select({ count: count() })
        .from(securityEvents)
        .where(and(
          eq(securityEvents.organizationId, orgId),
          gte(securityEvents.eventTimestamp, since),
        ));
      return result?.count ?? 0;
    });
  }

  async createInvestigation(orgId: string, eventId: string, userId: string) {
    return withTenant(this.db, orgId, async () => {
      const [event] = await this.db
        .select()
        .from(securityEvents)
        .where(and(eq(securityEvents.id, eventId), eq(securityEvents.organizationId, orgId)))
        .limit(1);

      if (!event) return null;

      const content = [
        `# Investigation for ${event.ruleName ?? event.type}`,
        "",
        "## Triggering Event",
        `- Event ID: ${event.id}`,
        `- Severity: ${event.severity}`,
        `- Source: ${event.source}`,
        `- Host: ${event.host ?? "unknown"}`,
        `- User: ${event.username ?? "unknown"}`,
        `- Source IP: ${event.sourceIp ?? "unknown"}`,
        `- Destination IP: ${event.destIp ?? "unknown"}`,
        "",
        "## Analyst Checklist",
        "- Validate alert fidelity against raw telemetry",
        "- Pivot to related endpoint, identity, DNS, and network events",
        "- Confirm scope and affected assets",
        "- Attach evidence and recommend containment",
      ].join("\n");

      const [notebook] = await this.db.insert(investigationNotebooks).values({
        organizationId: orgId,
        authorId: userId,
        title: `Event investigation - ${event.ruleName ?? event.type}`,
        content,
        isPublished: false,
      }).returning();

      return {
        id: notebook.id,
        title: notebook.title,
        updatedAt: notebook.updatedAt?.toISOString(),
      };
    });
  }

  /**
   * Suppress events similar to the given one by persisting an active
   * suppression rule (matching type + severity) and reporting how many
   * recent events the rule covers.
   */
  async suppressSimilar(
    orgId: string,
    eventId: string,
    actor: { id: string; name: string; email: string },
    reason?: string,
  ) {
    return withTenant(this.db, orgId, async () => {
      const [event] = await this.db
        .select()
        .from(securityEvents)
        .where(and(eq(securityEvents.id, eventId), eq(securityEvents.organizationId, orgId)))
        .limit(1);

      if (!event) return null;

      const condition = `type = '${event.type}' AND severity = '${event.severity}'`;

      const [rule] = await this.db.insert(alertSuppressionRules).values({
        organizationId: orgId,
        name: `Auto-suppress: ${event.type} (${event.severity})`,
        condition,
        createdBy: actor.name,
        isActive: true,
      }).returning();

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [{ value: matchedCount }] = await this.db
        .select({ value: count() })
        .from(securityEvents)
        .where(and(
          eq(securityEvents.organizationId, orgId),
          eq(securityEvents.type, event.type),
          eq(securityEvents.severity, event.severity),
          gte(securityEvents.eventTimestamp, since),
        ));

      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId: actor.id,
        userEmail: actor.email,
        action: "event.suppress_similar",
        resourceType: "security_event",
        resourceId: event.id,
      });

      return {
        ruleId: rule.id,
        suppressedCount: matchedCount,
        reason: reason || `Suppressed events matching ${event.type}/${event.severity} by ${actor.name}`,
      };
    });
  }

  /**
   * Open an incident from a triggering security event, seeding the timeline,
   * recommendations, and an audit record.
   */
  async createIncidentFromEvent(
    orgId: string,
    eventId: string,
    actor: { id: string; name: string; email: string },
  ) {
    return withTenant(this.db, orgId, async () => {
      const [event] = await this.db
        .select()
        .from(securityEvents)
        .where(and(eq(securityEvents.id, eventId), eq(securityEvents.organizationId, orgId)))
        .limit(1);

      if (!event) return null;

      const incidentCode = `INC-${Date.now().toString().slice(-6)}`;
      const title = event.ruleName ?? `${event.type} on ${event.host ?? "unknown asset"}`;

      const [incident] = await this.db.insert(incidents).values({
        organizationId: orgId,
        incidentCode,
        title,
        description: event.message,
        severity: event.severity,
        status: "investigating",
        category: event.type,
        affectedAssetsCount: 1,
        affectedUsersCount: event.username ? 1 : 0,
        summary: event.message,
        rootCauseAnalysis: "Pending analyst validation.",
      }).returning();

      await this.db.insert(incidentTimeline).values({
        incidentId: incident.id,
        timestamp: new Date(),
        actorType: "user",
        actorName: actor.name,
        actionType: "incident_created",
        description: `Created from security event ${event.id}`,
      });

      await this.db.insert(incidentRecommendations).values([
        { incidentId: incident.id, orderIndex: 1, content: "Validate event fidelity against raw telemetry." },
        { incidentId: incident.id, orderIndex: 2, content: "Pivot to related endpoint, identity, and network events." },
        { incidentId: incident.id, orderIndex: 3, content: "Confirm scope, assign a responder, and begin containment." },
      ]);

      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId: actor.id,
        userEmail: actor.email,
        action: "event.create_incident",
        resourceType: "incident",
        resourceId: incident.id,
      });

      return {
        id: incident.id,
        code: incident.incidentCode,
        title: incident.title,
        severity: incident.severity,
        status: incident.status ?? "investigating",
        openedAt: incident.openedAt?.toISOString(),
      };
    });
  }
}

function mapEvent(row: typeof securityEvents.$inferSelect) {
  return {
    id: row.id,
    timestamp: row.eventTimestamp.toISOString(),
    type: row.type,
    severity: row.severity,
    source: row.source,
    sourceIp: row.sourceIp,
    destIp: row.destIp,
    user: row.username,
    host: row.host,
    rule: row.ruleName,
    message: row.message,
    country: row.countryCode,
    asset: row.asset,
    mitre: row.mitreTechnique,
    raw: (row.rawData as Record<string, unknown>) ?? {},
  };
}

export { mapEvent };
