import { eq, desc, ilike, or } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { threatActors, threatActorTimeline, iocs } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class ThreatIntelService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listActors(search?: string, limit = 30) {
    const conditions = search
      ? or(ilike(threatActors.name, `%${search}%`))
      : undefined;

    const rows = await this.db
      .select()
      .from(threatActors)
      .where(conditions)
      .orderBy(desc(threatActors.lastSeen))
      .limit(limit);

    return Promise.all(rows.map(async (a) => {
      const timeline = await this.db
        .select()
        .from(threatActorTimeline)
        .where(eq(threatActorTimeline.actorId, a.id))
        .orderBy(desc(threatActorTimeline.eventDate))
        .limit(10);

      return {
        id: a.id,
        name: a.name,
        origin: a.originType ?? "unknown",
        motivation: (a.motivation as string[]) ?? [],
        ttps: (a.ttps as string[]) ?? [],
        aliases: (a.aliases as string[]) ?? [],
        activityTimeline: timeline.map((t) => ({
          date: t.eventDate.toISOString(),
          event: t.eventTitle,
        })),
        linkedCampaigns: (a.linkedCampaigns as string[]) ?? [],
        lastSeen: a.lastSeen?.toISOString() ?? "",
        severity: a.severity,
      };
    }));
  }

  async listIocs(orgId: string, limit = 50) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select()
        .from(iocs)
        .where(eq(iocs.organizationId, orgId))
        .orderBy(desc(iocs.createdAt))
        .limit(limit);

      return rows.map((i) => ({
        id: i.id,
        type: i.iocType,
        value: i.value,
        context: i.context,
        confidence: i.confidenceScore,
        severity: i.severity,
        isActive: i.isActive,
      }));
    });
  }
}
