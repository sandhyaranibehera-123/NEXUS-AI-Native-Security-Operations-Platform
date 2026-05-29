import { eq, and, desc, lt, ilike, or, sql, count } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import {
  incidents, incidentTimeline, incidentRecommendations, users,
} from "@nexus/db/schema";
import type postgres from "postgres";
import type { IncidentListQuery, UpdateIncidentStatus } from "@nexus/shared";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export class IncidentsService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
  ) {}

  async list(orgId: string, query: IncidentListQuery) {
    return withTenant(this.client, orgId, async () => {
      const conditions = [eq(incidents.organizationId, orgId)];

      if (query.status?.length) {
        conditions.push(sql`${incidents.status} = ANY(${query.status})`);
      }
      if (query.severity?.length) {
        conditions.push(sql`${incidents.severity} = ANY(${query.severity})`);
      }
      if (query.search) {
        const term = `%${query.search}%`;
        conditions.push(or(
          ilike(incidents.title, term),
          ilike(incidents.incidentCode, term),
        )!);
      }
      if (query.cursor) {
        conditions.push(lt(incidents.id, query.cursor));
      }

      const rows = await this.db
        .select({
          incident: incidents,
          assigneeName: users.fullName,
        })
        .from(incidents)
        .leftJoin(users, eq(incidents.leadInvestigatorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(incidents.openedAt))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      const slice = hasMore ? rows.slice(0, query.limit) : rows;

      const items = await Promise.all(slice.map(async ({ incident, assigneeName }) => {
        const recs = await this.db
          .select({ content: incidentRecommendations.content })
          .from(incidentRecommendations)
          .where(eq(incidentRecommendations.incidentId, incident.id))
          .orderBy(incidentRecommendations.orderIndex);

        const timeline = await this.db
          .select()
          .from(incidentTimeline)
          .where(eq(incidentTimeline.incidentId, incident.id))
          .orderBy(desc(incidentTimeline.timestamp));

        return mapIncident(incident, assigneeName, recs.map((r) => r.content), timeline);
      }));

      return {
        items,
        nextCursor: hasMore ? slice[slice.length - 1].incident.id : null,
      };
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.client, orgId, async () => {
      const [row] = await this.db
        .select({ incident: incidents, assigneeName: users.fullName })
        .from(incidents)
        .leftJoin(users, eq(incidents.leadInvestigatorId, users.id))
        .where(and(eq(incidents.id, id), eq(incidents.organizationId, orgId)))
        .limit(1);

      if (!row) return null;

      const recs = await this.db
        .select({ content: incidentRecommendations.content })
        .from(incidentRecommendations)
        .where(eq(incidentRecommendations.incidentId, id))
        .orderBy(incidentRecommendations.orderIndex);

      const timeline = await this.db
        .select()
        .from(incidentTimeline)
        .where(eq(incidentTimeline.incidentId, id))
        .orderBy(desc(incidentTimeline.timestamp));

      return mapIncident(row.incident, row.assigneeName, recs.map((r) => r.content), timeline);
    });
  }

  async getByCode(orgId: string, code: string) {
    return withTenant(this.client, orgId, async () => {
      const [row] = await this.db
        .select({ incident: incidents, assigneeName: users.fullName })
        .from(incidents)
        .leftJoin(users, eq(incidents.leadInvestigatorId, users.id))
        .where(and(eq(incidents.incidentCode, code), eq(incidents.organizationId, orgId)))
        .limit(1);

      if (!row) return null;

      const recs = await this.db
        .select({ content: incidentRecommendations.content })
        .from(incidentRecommendations)
        .where(eq(incidentRecommendations.incidentId, row.incident.id))
        .orderBy(incidentRecommendations.orderIndex);

      const timeline = await this.db
        .select()
        .from(incidentTimeline)
        .where(eq(incidentTimeline.incidentId, row.incident.id))
        .orderBy(desc(incidentTimeline.timestamp));

      return mapIncident(row.incident, row.assigneeName, recs.map((r) => r.content), timeline);
    });
  }

  async updateStatus(orgId: string, id: string, body: UpdateIncidentStatus, actorName: string) {
    return withTenant(this.client, orgId, async () => {
      const [existing] = await this.db
        .select()
        .from(incidents)
        .where(and(eq(incidents.id, id), eq(incidents.organizationId, orgId)))
        .limit(1);

      if (!existing) throw new NotFoundError("Incident not found");

      await this.db
        .update(incidents)
        .set({ status: body.status, updatedAt: new Date() })
        .where(eq(incidents.id, id));

      await this.db.insert(incidentTimeline).values({
        incidentId: id,
        timestamp: new Date(),
        actorType: "user",
        actorName,
        actionType: "status_change",
        description: `Status changed to ${body.status}`,
      });

      return this.getById(orgId, id);
    });
  }

  async countOpen(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const [result] = await this.db
        .select({ count: count() })
        .from(incidents)
        .where(and(
          eq(incidents.organizationId, orgId),
          sql`${incidents.status} IN ('open', 'investigating', 'contained')`,
        ));
      return result?.count ?? 0;
    });
  }
}

function mapIncident(
  row: typeof incidents.$inferSelect,
  assignee: string | null,
  recommendations: string[],
  timeline: (typeof incidentTimeline.$inferSelect)[],
) {
  return {
    id: row.id,
    code: row.incidentCode,
    title: row.title,
    severity: row.severity,
    status: row.status,
    assignee,
    openedAt: row.openedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    affectedAssets: row.affectedAssetsCount ?? 0,
    affectedUsers: row.affectedUsersCount ?? 0,
    category: row.category,
    mitre: [] as string[],
    summary: row.summary,
    rca: row.rootCauseAnalysis,
    recommendations,
    linkedEventIds: [] as string[],
    timeline: timeline.map((t) => ({
      at: t.timestamp.toISOString(),
      actor: t.actorName ?? "System",
      action: t.actionType,
      detail: t.description,
    })),
  };
}
