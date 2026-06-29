import { eq, and, desc, ilike, or } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import {
  threatActors, threatActorTimeline, iocs,
  ransomwareGroups, threatCampaigns, campaignActors, campaignEvents,
} from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

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
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(iocs)
        .where(eq(iocs.organizationId, orgId))
        .orderBy(desc(iocs.createdAt))
        .limit(limit);

      return rows.map(mapIoc);
    });
  }

  async listRansomware(orgId: string, limit = 12) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(ransomwareGroups)
        .orderBy(desc(ransomwareGroups.updatedAt))
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        encryption: r.encryption ?? "Unknown",
        sectors: (r.sectors as string[]) ?? [],
        recentVictims: (r.recentVictims as string[]) ?? [],
        severity: r.severity ?? "high",
        active: r.isActive ?? true,
      }));
    });
  }

  async listCampaigns(orgId: string, limit = 10) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(threatCampaigns)
        .orderBy(desc(threatCampaigns.updatedAt))
        .limit(limit);

      return Promise.all(rows.map(async (c) => {
        const [actorLinks, events] = await Promise.all([
          this.db
            .select({ name: threatActors.name })
            .from(campaignActors)
            .innerJoin(threatActors, eq(campaignActors.actorId, threatActors.id))
            .where(eq(campaignActors.campaignId, c.id)),
          this.db
            .select()
            .from(campaignEvents)
            .where(eq(campaignEvents.campaignId, c.id))
            .orderBy(campaignEvents.eventAt),
        ]);

        return {
          id: c.id,
          name: c.name,
          actor: actorLinks.map((a) => a.name).join(" / ") || "Unknown",
          sectors: (c.sectors as string[]) ?? [],
          events: events.map((e) => ({ at: e.eventAt.toISOString(), desc: e.description })),
          severity: c.severity ?? "high",
        };
      }));
    });
  }

  async createIoc(orgId: string, data: {
    iocType: string;
    value: string;
    context?: string;
    confidenceScore?: number;
    severity?: string;
    threatActorId?: string;
    expiresAt?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(iocs).values({
        organizationId: orgId,
        threatActorId: data.threatActorId ?? null,
        iocType: data.iocType,
        value: data.value,
        context: data.context ?? null,
        confidenceScore: data.confidenceScore ?? 80,
        severity: data.severity ?? "high",
        isActive: true,
        firstSeen: new Date(),
        lastSeen: new Date(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      }).returning();
      return mapIoc(row);
    });
  }

  async updateIoc(orgId: string, id: string, data: {
    context?: string;
    confidenceScore?: number;
    severity?: string;
    isActive?: boolean;
    expiresAt?: string | null;
  }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof iocs.$inferInsert> = { lastSeen: new Date() };
      if (data.context !== undefined) updates.context = data.context;
      if (data.confidenceScore !== undefined) updates.confidenceScore = data.confidenceScore;
      if (data.severity !== undefined) updates.severity = data.severity;
      if (data.isActive !== undefined) updates.isActive = data.isActive;
      if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

      const [row] = await this.db
        .update(iocs)
        .set(updates)
        // Org-scoped IOCs only — global threat-intel feed rows (organization_id
        // IS NULL) are not editable through a single tenant's API.
        .where(and(eq(iocs.id, id), eq(iocs.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("IOC not found");
      return mapIoc(row);
    });
  }

  async deleteIoc(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [deleted] = await this.db
        .delete(iocs)
        .where(and(eq(iocs.id, id), eq(iocs.organizationId, orgId)))
        .returning({ id: iocs.id });
      if (!deleted) throw new NotFoundError("IOC not found");
    });
  }

  async importIocs(orgId: string, items: { iocType: string; value: string; severity?: string; confidenceScore?: number }[]) {
    return withTenant(this.db, orgId, async () => {
      if (items.length === 0) return { imported: 0 };
      const rows = await this.db.insert(iocs).values(items.map((item) => ({
        organizationId: orgId,
        iocType: item.iocType,
        value: item.value,
        severity: item.severity ?? "high",
        confidenceScore: item.confidenceScore ?? 80,
        isActive: true,
        firstSeen: new Date(),
        lastSeen: new Date(),
      }))).returning({ id: iocs.id });
      return { imported: rows.length };
    });
  }
}

function mapIoc(i: typeof iocs.$inferSelect) {
  return {
    id: i.id,
    type: i.iocType,
    value: i.value,
    context: i.context,
    confidence: i.confidenceScore,
    severity: i.severity,
    isActive: i.isActive,
    expiresAt: i.expiresAt?.toISOString() ?? null,
  };
}
