import { eq, and, desc, lt, ilike, or, sql, count, inArray, gte } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import {
  incidents, incidentTimeline, incidentRecommendations, incidentComments,
  incidentEvidence, incidentResponders, incidentMitreTechniques, incidentAlerts,
  users, auditLogs,
} from "@nexus/db/schema";
import type postgres from "postgres";
import type { IncidentListQuery, UpdateIncidentStatus } from "@nexus/shared";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

type IncidentRow = typeof incidents.$inferSelect;
type TimelineRow = typeof incidentTimeline.$inferSelect;
type ResponderRow = { userId: string; role: string; joinedAt: Date | null; userName: string | null; email: string | null };

function mapIncident(
  incident: IncidentRow,
  assigneeName: string | null,
  recommendations: string[],
  timeline: TimelineRow[],
  responders: ResponderRow[] = [],
  mitre: { mitreId: string; mitreName: string | null; mitreTactic: string | null }[] = [],
  linkedAlertIds: string[] = [],
) {
  const slaHours = incident.slaHours ?? 24;
  const openedAt = incident.openedAt ?? new Date();
  const breachAt = incident.slaBreachAt ?? new Date(openedAt.getTime() + slaHours * 60 * 60 * 1000);

  return {
    id: incident.id,
    code: incident.incidentCode,
    title: incident.title,
    severity: incident.severity,
    status: incident.status ?? "open",
    assignee: assigneeName ?? "Unassigned",
    assigneeId: incident.leadInvestigatorId,
    openedAt: openedAt.toISOString(),
    updatedAt: incident.updatedAt?.toISOString() ?? new Date().toISOString(),
    containedAt: incident.containedAt?.toISOString() ?? null,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    closedAt: incident.closedAt?.toISOString() ?? null,
    affectedAssets: incident.affectedAssetsCount ?? 0,
    affectedUsers: incident.affectedUsersCount ?? 0,
    category: incident.category ?? "",
    summary: incident.summary ?? "",
    rca: incident.rootCauseAnalysis ?? "",
    remediationSteps: incident.remediationSteps ?? "",
    postmortemUrl: incident.postmortemUrl ?? null,
    mitre: mitre.map((m) => m.mitreId),
    mitreTechniques: mitre,
    linkedAlertIds,
    recommendations,
    timeline: timeline.map((t) => ({
      id: t.id,
      at: t.timestamp.toISOString(),
      actor: t.actorName ?? "System",
      actorType: t.actorType,
      action: t.actionType,
      detail: t.description,
    })),
    sla: {
      targetHours: slaHours,
      targetMinutes: slaHours * 60,
      startedAt: openedAt.toISOString(),
      breachAt: breachAt.toISOString(),
      breached: incident.slaBreached ?? false,
      escalationAt: Math.round(slaHours * 60 * 0.75),
    },
    responders: responders.map((r) => ({
      userId: r.userId,
      name: r.userName ?? r.userId,
      email: r.email ?? "",
      role: r.role,
      joinedAt: r.joinedAt?.toISOString() ?? new Date().toISOString(),
    })),
    escalated: incident.escalated ?? false,
    escalatedAt: incident.escalatedAt?.toISOString() ?? null,
  };
}

export class IncidentsService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
  ) {}

  async list(orgId: string, query: IncidentListQuery) {
    return withTenant(this.db, orgId, async () => {
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

      const incidentIds = slice.map((r) => r.incident.id);

      const [allRecs, allTimeline, allResponders, allMitre] = incidentIds.length > 0
        ? await Promise.all([
            this.db
              .select({ incidentId: incidentRecommendations.incidentId, content: incidentRecommendations.content })
              .from(incidentRecommendations)
              .where(inArray(incidentRecommendations.incidentId, incidentIds))
              .orderBy(incidentRecommendations.orderIndex),
            this.db
              .select()
              .from(incidentTimeline)
              .where(inArray(incidentTimeline.incidentId, incidentIds))
              .orderBy(desc(incidentTimeline.timestamp)),
            this.db
              .select({
                incidentId: incidentResponders.incidentId,
                userId: incidentResponders.userId,
                role: incidentResponders.role,
                joinedAt: incidentResponders.joinedAt,
                userName: users.fullName,
                email: users.email,
              })
              .from(incidentResponders)
              .leftJoin(users, eq(incidentResponders.userId, users.id))
              .where(inArray(incidentResponders.incidentId, incidentIds)),
            this.db
              .select()
              .from(incidentMitreTechniques)
              .where(inArray(incidentMitreTechniques.incidentId, incidentIds)),
          ])
        : [[], [], [], []];

      const recsByIncident = new Map<string, string[]>();
      for (const r of allRecs) {
        if (!recsByIncident.has(r.incidentId)) recsByIncident.set(r.incidentId, []);
        recsByIncident.get(r.incidentId)!.push(r.content);
      }

      const timelineByIncident = new Map<string, typeof allTimeline>();
      for (const t of allTimeline) {
        if (!timelineByIncident.has(t.incidentId)) timelineByIncident.set(t.incidentId, []);
        timelineByIncident.get(t.incidentId)!.push(t);
      }

      const respondersByIncident = new Map<string, ResponderRow[]>();
      for (const r of allResponders) {
        if (!respondersByIncident.has(r.incidentId)) respondersByIncident.set(r.incidentId, []);
        respondersByIncident.get(r.incidentId)!.push({
          userId: r.userId,
          role: r.role ?? "responder",
          joinedAt: r.joinedAt,
          userName: r.userName,
          email: r.email,
        });
      }

      const mitreByIncident = new Map<string, typeof allMitre>();
      for (const m of allMitre) {
        if (!mitreByIncident.has(m.incidentId)) mitreByIncident.set(m.incidentId, []);
        mitreByIncident.get(m.incidentId)!.push(m);
      }

      const items = slice.map(({ incident, assigneeName }) =>
        mapIncident(
          incident,
          assigneeName,
          recsByIncident.get(incident.id) ?? [],
          timelineByIncident.get(incident.id) ?? [],
          respondersByIncident.get(incident.id) ?? [],
          mitreByIncident.get(incident.id) ?? [],
        ),
      );

      return {
        items,
        nextCursor: hasMore ? slice[slice.length - 1].incident.id : null,
      };
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .select({ incident: incidents, assigneeName: users.fullName })
        .from(incidents)
        .leftJoin(users, eq(incidents.leadInvestigatorId, users.id))
        .where(and(eq(incidents.id, id), eq(incidents.organizationId, orgId)))
        .limit(1);

      if (!row) return null;

      const [recs, timeline, responders, mitre, linkedAlerts] = await Promise.all([
        this.db
          .select({ content: incidentRecommendations.content })
          .from(incidentRecommendations)
          .where(eq(incidentRecommendations.incidentId, id))
          .orderBy(incidentRecommendations.orderIndex),
        this.db
          .select()
          .from(incidentTimeline)
          .where(eq(incidentTimeline.incidentId, id))
          .orderBy(desc(incidentTimeline.timestamp)),
        this.db
          .select({
            userId: incidentResponders.userId,
            role: incidentResponders.role,
            joinedAt: incidentResponders.joinedAt,
            userName: users.fullName,
            email: users.email,
          })
          .from(incidentResponders)
          .leftJoin(users, eq(incidentResponders.userId, users.id))
          .where(eq(incidentResponders.incidentId, id)),
        this.db
          .select()
          .from(incidentMitreTechniques)
          .where(eq(incidentMitreTechniques.incidentId, id)),
        this.db
          .select({ alertId: incidentAlerts.alertId })
          .from(incidentAlerts)
          .where(eq(incidentAlerts.incidentId, id)),
      ]);

      return mapIncident(
        row.incident,
        row.assigneeName,
        recs.map((r) => r.content),
        timeline,
        responders.map((r) => ({ ...r, role: r.role ?? "responder" })),
        mitre,
        linkedAlerts.map((a) => a.alertId),
      );
    });
  }

  async getByCode(orgId: string, code: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .select({ incident: incidents, assigneeName: users.fullName })
        .from(incidents)
        .leftJoin(users, eq(incidents.leadInvestigatorId, users.id))
        .where(and(eq(incidents.incidentCode, code), eq(incidents.organizationId, orgId)))
        .limit(1);

      if (!row) return null;
      return this.getById(orgId, row.incident.id);
    });
  }

  async create(orgId: string, userId: string, userEmail: string, data: {
    title: string;
    description?: string;
    severity: string;
    category?: string;
    affectedAssetsCount?: number;
    affectedUsersCount?: number;
    slaHours?: number;
    leadInvestigatorId?: string;
    mitreTechniques?: { mitreId: string; mitreName?: string; mitreTactic?: string }[];
  }) {
    return withTenant(this.db, orgId, async () => {
      const existingCount = await this.db.$count(incidents, eq(incidents.organizationId, orgId));
      const incidentCode = `INC-${String((existingCount ?? 0) + 1).padStart(4, "0")}`;
      const slaHours = data.slaHours ?? 24;
      const now = new Date();
      const slaBreachAt = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

      const [incident] = await this.db
        .insert(incidents)
        .values({
          organizationId: orgId,
          incidentCode,
          title: data.title,
          description: data.description,
          severity: data.severity,
          status: "open",
          category: data.category,
          affectedAssetsCount: data.affectedAssetsCount ?? 0,
          affectedUsersCount: data.affectedUsersCount ?? 0,
          leadInvestigatorId: data.leadInvestigatorId ?? userId,
          slaHours,
          slaBreachAt,
          slaBreached: false,
          openedAt: now,
          updatedAt: now,
        })
        .returning();

      // Add creator as responder
      await this.db.insert(incidentResponders).values({
        incidentId: incident.id,
        userId,
        role: "lead",
        joinedAt: now,
      }).onConflictDoNothing();

      // Seed MITRE techniques
      if (data.mitreTechniques?.length) {
        await this.db.insert(incidentMitreTechniques).values(
          data.mitreTechniques.map((m) => ({
            incidentId: incident.id,
            mitreId: m.mitreId,
            mitreName: m.mitreName,
            mitreTactic: m.mitreTactic,
          })),
        ).onConflictDoNothing();
      }

      // Timeline entry
      await this.db.insert(incidentTimeline).values({
        incidentId: incident.id,
        timestamp: now,
        actorType: "user",
        actorName: userEmail,
        actionType: "created",
        description: `Incident ${incidentCode} created`,
      });

      // Audit log
      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId,
        userEmail,
        action: "incident.create",
        resourceType: "incident",
        resourceId: incident.id,
        resourceLabel: incidentCode,
        newValues: { title: data.title, severity: data.severity },
      });

      return this.getById(orgId, incident.id);
    });
  }

  async update(orgId: string, id: string, userId: string, userEmail: string, data: {
    title?: string;
    description?: string;
    severity?: string;
    category?: string;
    summary?: string;
    remediationSteps?: string;
    affectedAssetsCount?: number;
    affectedUsersCount?: number;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [existing] = await this.db
        .select()
        .from(incidents)
        .where(and(eq(incidents.id, id), eq(incidents.organizationId, orgId)))
        .limit(1);

      if (!existing) throw new NotFoundError("Incident not found");

      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (data.title !== undefined) updateFields.title = data.title;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.severity !== undefined) updateFields.severity = data.severity;
      if (data.category !== undefined) updateFields.category = data.category;
      if (data.summary !== undefined) updateFields.summary = data.summary;
      if (data.remediationSteps !== undefined) updateFields.remediationSteps = data.remediationSteps;
      if (data.affectedAssetsCount !== undefined) updateFields.affectedAssetsCount = data.affectedAssetsCount;
      if (data.affectedUsersCount !== undefined) updateFields.affectedUsersCount = data.affectedUsersCount;

      await this.db.update(incidents).set(updateFields).where(eq(incidents.id, id));

      if (data.severity && data.severity !== existing.severity) {
        await this.db.insert(incidentTimeline).values({
          incidentId: id,
          timestamp: new Date(),
          actorType: "user",
          actorName: userEmail,
          actionType: "severity_change",
          description: `Severity changed from ${existing.severity} to ${data.severity}`,
        });
      }

      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId,
        userEmail,
        action: "incident.update",
        resourceType: "incident",
        resourceId: id,
        oldValues: { title: existing.title, severity: existing.severity },
        newValues: data,
      });

      return this.getById(orgId, id);
    });
  }

  async delete(orgId: string, id: string, userId: string, userEmail: string) {
    return withTenant(this.db, orgId, async () => {
      const [existing] = await this.db
        .select({ id: incidents.id, incidentCode: incidents.incidentCode })
        .from(incidents)
        .where(and(eq(incidents.id, id), eq(incidents.organizationId, orgId)))
        .limit(1);

      if (!existing) throw new NotFoundError("Incident not found");

      await this.db.delete(incidents).where(eq(incidents.id, id));

      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId,
        userEmail,
        action: "incident.delete",
        resourceType: "incident",
        resourceId: id,
        resourceLabel: existing.incidentCode,
      });
    });
  }

  async addResponder(orgId: string, incidentId: string, userId: string, role: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .insert(incidentResponders)
        .values({ incidentId, userId, role, joinedAt: new Date() })
        .onConflictDoNothing();

      const [user] = await this.db
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return {
        userId,
        name: user?.fullName ?? userId,
        email: user?.email ?? "",
        role,
        joinedAt: new Date().toISOString(),
      };
    });
  }

  async removeResponder(orgId: string, incidentId: string, userId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(incidentResponders)
        .where(and(
          eq(incidentResponders.incidentId, incidentId),
          eq(incidentResponders.userId, userId),
        ));
    });
  }

  async listResponders(orgId: string, incidentId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({
          userId: incidentResponders.userId,
          role: incidentResponders.role,
          joinedAt: incidentResponders.joinedAt,
          userName: users.fullName,
          email: users.email,
        })
        .from(incidentResponders)
        .leftJoin(users, eq(incidentResponders.userId, users.id))
        .where(eq(incidentResponders.incidentId, incidentId));

      return rows.map((r) => ({
        userId: r.userId,
        name: r.userName ?? r.userId,
        email: r.email ?? "",
        role: r.role ?? "responder",
        joinedAt: r.joinedAt?.toISOString() ?? new Date().toISOString(),
      }));
    });
  }

  async updateStatus(orgId: string, id: string, body: UpdateIncidentStatus, actorName: string) {
    return withTenant(this.db, orgId, async () => {
      const [existing] = await this.db
        .select()
        .from(incidents)
        .where(and(eq(incidents.id, id), eq(incidents.organizationId, orgId)))
        .limit(1);

      if (!existing) throw new NotFoundError("Incident not found");

      const updateFields: Record<string, unknown> = { status: body.status, updatedAt: new Date() };
      if (body.status === "contained") updateFields.containedAt = new Date();
      if (body.status === "closed") updateFields.closedAt = new Date();

      await this.db.update(incidents).set(updateFields).where(eq(incidents.id, id));

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

  async escalate(orgId: string, id: string, reason: string, newSeverity: string | undefined, actorName: string) {
    return withTenant(this.db, orgId, async () => {
      const updateFields: Record<string, unknown> = {
        escalated: true,
        escalatedAt: new Date(),
        updatedAt: new Date(),
      };
      if (newSeverity) updateFields.severity = newSeverity;

      await this.db.update(incidents).set(updateFields).where(
        and(eq(incidents.id, id), eq(incidents.organizationId, orgId)),
      );

      await this.db.insert(incidentTimeline).values({
        incidentId: id,
        timestamp: new Date(),
        actorType: "user",
        actorName,
        actionType: "escalation",
        description: reason,
      });

      return this.getById(orgId, id);
    });
  }

  async getTimeline(orgId: string, incidentId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(incidentTimeline)
        .where(eq(incidentTimeline.incidentId, incidentId))
        .orderBy(desc(incidentTimeline.timestamp));
      return rows.map((t) => ({
        id: t.id,
        at: t.timestamp.toISOString(),
        actor: t.actorName ?? "System",
        actorType: t.actorType,
        action: t.actionType,
        detail: t.description,
      }));
    });
  }

  async listComments(orgId: string, incidentId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({ comment: incidentComments, authorName: users.fullName })
        .from(incidentComments)
        .leftJoin(users, eq(incidentComments.authorId, users.id))
        .where(eq(incidentComments.incidentId, incidentId))
        .orderBy(desc(incidentComments.createdAt));

      return rows.map(({ comment, authorName }) => ({
        id: comment.id,
        content: comment.content,
        author: authorName ?? "System",
        isSystem: comment.isSystemGenerated ?? false,
        createdAt: comment.createdAt?.toISOString(),
      }));
    });
  }

  async addComment(orgId: string, incidentId: string, authorId: string, content: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(incidentComments).values({
        incidentId,
        authorId,
        content,
      }).returning();
      return {
        id: row.id,
        content: row.content,
        createdAt: row.createdAt?.toISOString(),
      };
    });
  }

  async listEvidence(orgId: string, incidentId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({ evidence: incidentEvidence, addedByName: users.fullName })
        .from(incidentEvidence)
        .leftJoin(users, eq(incidentEvidence.addedBy, users.id))
        .where(eq(incidentEvidence.incidentId, incidentId))
        .orderBy(desc(incidentEvidence.addedAt));

      return rows.map(({ evidence, addedByName }) => ({
        id: evidence.id,
        type: evidence.type,
        title: evidence.title,
        description: evidence.description,
        fileName: evidence.fileName,
        fileSizeBytes: evidence.fileSizeBytes,
        mimeType: evidence.mimeType,
        storageUri: evidence.storageUri,
        hashSha256: evidence.hashSha256,
        isSensitive: evidence.isSensitive,
        addedBy: addedByName ?? "System",
        addedAt: evidence.addedAt?.toISOString(),
      }));
    });
  }

  async addEvidence(orgId: string, incidentId: string, addedBy: string, data: {
    type: string;
    title: string;
    description?: string;
    fileName?: string;
    fileSizeBytes?: number;
    mimeType?: string;
    storageUri?: string;
    hashSha256?: string;
    isSensitive?: boolean;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(incidentEvidence).values({
        incidentId,
        addedBy,
        ...data,
        addedAt: new Date(),
      }).returning();
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        fileName: row.fileName,
        addedAt: row.addedAt?.toISOString(),
      };
    });
  }

  async updateSeverity(orgId: string, id: string, severity: string, actorName: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db.update(incidents).set({ severity, updatedAt: new Date() }).where(
        and(eq(incidents.id, id), eq(incidents.organizationId, orgId)),
      );
      await this.db.insert(incidentTimeline).values({
        incidentId: id,
        timestamp: new Date(),
        actorType: "user",
        actorName,
        actionType: "severity_change",
        description: `Severity escalated to ${severity}`,
      });
    });
  }

  async updateAssignee(orgId: string, id: string, assigneeId: string, actorName: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .update(incidents)
        .set({ leadInvestigatorId: assigneeId, updatedAt: new Date() })
        .where(and(eq(incidents.id, id), eq(incidents.organizationId, orgId)));
      await this.db.insert(incidentTimeline).values({
        incidentId: id,
        timestamp: new Date(),
        actorType: "user",
        actorName,
        actionType: "reassignment",
        description: "Lead investigator changed",
      });
      return this.getById(orgId, id);
    });
  }

  async updateRca(orgId: string, id: string, rca: string, actorName: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .update(incidents)
        .set({ rootCauseAnalysis: rca, updatedAt: new Date() })
        .where(and(eq(incidents.id, id), eq(incidents.organizationId, orgId)));
      await this.db.insert(incidentTimeline).values({
        incidentId: id,
        timestamp: new Date(),
        actorType: "user",
        actorName,
        actionType: "rca_update",
        description: "Root cause analysis updated",
      });
    });
  }

  async listRemediations(orgId: string, incidentId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(incidentRecommendations)
        .where(eq(incidentRecommendations.incidentId, incidentId))
        .orderBy(incidentRecommendations.orderIndex);
      return rows.map((r) => ({
        id: r.id,
        title: r.content,
        status: r.isCompleted ? "complete" : "pending",
        completedAt: r.completedAt?.toISOString() ?? null,
      }));
    });
  }

  async createRemediation(orgId: string, incidentId: string, data: { title: string; assignee?: string; dueDate?: string }, actorName: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(incidentRecommendations).values({
        incidentId,
        content: data.title,
        isCompleted: false,
        orderIndex: 0,
      }).returning();
      return {
        id: row.id,
        title: row.content,
        status: "pending" as const,
        owner: data.assignee ?? actorName,
        dueAt: data.dueDate ?? null,
        completedAt: null,
      };
    });
  }

  async updateRemediationStatus(remId: string, status: string, actorName: string) {
    const isCompleted = status === "complete";
    const [row] = await this.db
      .update(incidentRecommendations)
      .set({
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      })
      .where(eq(incidentRecommendations.id, remId))
      .returning();
    return {
      id: row?.id ?? remId,
      status,
      completedAt: row?.completedAt?.toISOString() ?? null,
    };
  }

  generatePostmortemTemplate(incident: { id: string; code: string; title: string; severity: string; openedAt: string; summary: string; rca: string }) {
    return {
      incidentId: incident.id,
      code: incident.code,
      generatedAt: new Date().toISOString(),
      sections: [
        { title: "Incident Summary", content: incident.summary || `${incident.title} — severity: ${incident.severity}` },
        { title: "Timeline", content: "See incident timeline for full chronology." },
        { title: "Root Cause Analysis", content: incident.rca || "Root cause analysis pending." },
        { title: "Impact Assessment", content: "Document affected systems, users, and data." },
        { title: "Detection & Response Evaluation", content: "Evaluate time-to-detect and time-to-respond against SLA targets." },
        { title: "Remediation Actions Taken", content: "List all remediation steps completed during response." },
        { title: "Lessons Learned & Action Items", content: "Document process improvements and assign follow-up tasks." },
      ],
    };
  }

  async checkSlaBreach(orgId: string) {
    const now = new Date();
    const breached = await this.db
      .select({ id: incidents.id, incidentCode: incidents.incidentCode })
      .from(incidents)
      .where(and(
        eq(incidents.organizationId, orgId),
        eq(incidents.slaBreached, false),
        sql`${incidents.slaBreachAt} <= ${now}`,
        sql`${incidents.status} NOT IN ('resolved', 'closed')`,
      ));

    for (const inc of breached) {
      await this.db
        .update(incidents)
        .set({ slaBreached: true, updatedAt: now })
        .where(eq(incidents.id, inc.id));
      await this.db.insert(incidentTimeline).values({
        incidentId: inc.id,
        timestamp: now,
        actorType: "system",
        actorName: "SLA Monitor",
        actionType: "sla_breach",
        description: `SLA breached for incident ${inc.incidentCode}`,
      });
    }

    return breached.length;
  }
}
