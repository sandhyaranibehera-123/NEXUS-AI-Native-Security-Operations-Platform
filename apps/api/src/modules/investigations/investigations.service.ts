import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import {
  investigationNotebooks, investigationNotes, auditLogs,
  investigationEvidence, investigationEntities,
} from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export class InvestigationsService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, limit = 50) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(investigationNotebooks)
        .where(eq(investigationNotebooks.organizationId, orgId))
        .orderBy(desc(investigationNotebooks.updatedAt))
        .limit(limit);

      return rows.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        caseId: n.caseId,
        incidentId: n.incidentId,
        isPublished: n.isPublished,
        updatedAt: n.updatedAt?.toISOString(),
        createdAt: n.createdAt?.toISOString(),
      }));
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .select()
        .from(investigationNotebooks)
        .where(and(eq(investigationNotebooks.id, id), eq(investigationNotebooks.organizationId, orgId)))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        caseId: row.caseId,
        incidentId: row.incidentId,
        isPublished: row.isPublished,
        updatedAt: row.updatedAt?.toISOString(),
        createdAt: row.createdAt?.toISOString(),
      };
    });
  }

  async create(orgId: string, authorId: string, data: {
    title: string;
    content?: string;
    caseId?: string;
    incidentId?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(investigationNotebooks).values({
        organizationId: orgId,
        authorId,
        title: data.title,
        content: data.content ?? "",
        caseId: data.caseId ?? null,
        incidentId: data.incidentId ?? null,
        isPublished: false,
      }).returning();

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        caseId: row.caseId,
        incidentId: row.incidentId,
        isPublished: row.isPublished,
        updatedAt: row.updatedAt?.toISOString(),
        createdAt: row.createdAt?.toISOString(),
      };
    });
  }

  async update(orgId: string, id: string, data: {
    title?: string;
    content?: string;
    isPublished?: boolean;
    caseId?: string;
    incidentId?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof investigationNotebooks.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (data.title !== undefined) updates.title = data.title;
      if (data.content !== undefined) updates.content = data.content;
      if (data.isPublished !== undefined) updates.isPublished = data.isPublished;
      if (data.caseId !== undefined) updates.caseId = data.caseId;
      if (data.incidentId !== undefined) updates.incidentId = data.incidentId;

      const [row] = await this.db
        .update(investigationNotebooks)
        .set(updates)
        .where(and(eq(investigationNotebooks.id, id), eq(investigationNotebooks.organizationId, orgId)))
        .returning();

      if (!row) return null;
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        caseId: row.caseId,
        incidentId: row.incidentId,
        isPublished: row.isPublished,
        updatedAt: row.updatedAt?.toISOString(),
        createdAt: row.createdAt?.toISOString(),
      };
    });
  }

  /**
   * Return the investigation notebook linked to an incident, creating one if it
   * does not yet exist. Guarantees a stable incident ↔ investigation relationship.
   */
  async getOrCreateForIncident(
    orgId: string,
    incident: { id: string; code: string; title: string },
    author: { id: string; name: string; email: string },
  ) {
    return withTenant(this.db, orgId, async () => {
      const [existing] = await this.db
        .select()
        .from(investigationNotebooks)
        .where(and(
          eq(investigationNotebooks.organizationId, orgId),
          eq(investigationNotebooks.incidentId, incident.id),
        ))
        .orderBy(desc(investigationNotebooks.updatedAt))
        .limit(1);

      if (existing) {
        return { ...mapNotebook(existing), created: false };
      }

      const content = [
        `# Investigation — ${incident.code}`,
        "",
        `Linked incident: **${incident.title}** (${incident.code})`,
        "",
        "## Working notes",
        "- ",
      ].join("\n");

      const [row] = await this.db.insert(investigationNotebooks).values({
        organizationId: orgId,
        authorId: author.id,
        incidentId: incident.id,
        title: `Investigation — ${incident.code}`,
        content,
        isPublished: false,
      }).returning();

      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId: author.id,
        userEmail: author.email,
        action: "investigation.open_from_incident",
        resourceType: "investigation",
        resourceId: row.id,
      });

      return { ...mapNotebook(row), created: true };
    });
  }

  async delete(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(investigationNotes)
        .where(and(eq(investigationNotes.investigationId, id), eq(investigationNotes.organizationId, orgId)));
      await this.db
        .delete(investigationNotebooks)
        .where(and(eq(investigationNotebooks.id, id), eq(investigationNotebooks.organizationId, orgId)));
    });
  }

  async listNotes(orgId: string, investigationId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(investigationNotes)
        .where(and(
          eq(investigationNotes.organizationId, orgId),
          eq(investigationNotes.investigationId, investigationId),
        ))
        .orderBy(desc(investigationNotes.createdAt));
      return rows.map((n) => ({
        id: n.id,
        author: n.authorName ?? "analyst",
        body: n.body,
        at: n.createdAt?.toISOString() ?? new Date().toISOString(),
      }));
    });
  }

  async addNote(
    orgId: string,
    investigationId: string,
    author: { id: string; name: string; email: string },
    body: string,
  ) {
    return withTenant(this.db, orgId, async () => {
      // Ensure the investigation exists and belongs to the tenant.
      const [parent] = await this.db
        .select({ id: investigationNotebooks.id })
        .from(investigationNotebooks)
        .where(and(
          eq(investigationNotebooks.id, investigationId),
          eq(investigationNotebooks.organizationId, orgId),
        ))
        .limit(1);
      if (!parent) return null;

      const [row] = await this.db.insert(investigationNotes).values({
        organizationId: orgId,
        investigationId,
        authorId: author.id,
        authorName: author.name,
        body,
      }).returning();

      // Touch the parent so list ordering reflects recent activity.
      await this.db
        .update(investigationNotebooks)
        .set({ updatedAt: new Date() })
        .where(eq(investigationNotebooks.id, investigationId));

      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId: author.id,
        userEmail: author.email,
        action: "investigation.add_note",
        resourceType: "investigation",
        resourceId: investigationId,
      });

      return {
        id: row.id,
        author: row.authorName ?? author.name,
        body: row.body,
        at: row.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  async #assertOwned(orgId: string, investigationId: string) {
    const [row] = await this.db
      .select({ id: investigationNotebooks.id })
      .from(investigationNotebooks)
      .where(and(eq(investigationNotebooks.id, investigationId), eq(investigationNotebooks.organizationId, orgId)))
      .limit(1);
    if (!row) throw new NotFoundError("Investigation not found");
  }

  async listEvidence(orgId: string, investigationId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.#assertOwned(orgId, investigationId);
      const rows = await this.db
        .select()
        .from(investigationEvidence)
        .where(and(eq(investigationEvidence.investigationId, investigationId), eq(investigationEvidence.organizationId, orgId)))
        .orderBy(desc(investigationEvidence.addedAt));

      return rows.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        fileName: e.fileName,
        mimeType: e.mimeType,
        storageUri: e.storageUri,
        hashSha256: e.hashSha256,
        addedAt: e.addedAt?.toISOString(),
      }));
    });
  }

  async addEvidence(orgId: string, investigationId: string, addedBy: string, data: {
    type: string;
    title: string;
    description?: string;
    fileName?: string;
    mimeType?: string;
    storageUri?: string;
    hashSha256?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      await this.#assertOwned(orgId, investigationId);
      const [row] = await this.db.insert(investigationEvidence).values({
        organizationId: orgId,
        investigationId,
        addedBy,
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        fileName: data.fileName ?? null,
        mimeType: data.mimeType ?? null,
        storageUri: data.storageUri ?? null,
        hashSha256: data.hashSha256 ?? null,
      }).returning();

      return {
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        fileName: row.fileName,
        mimeType: row.mimeType,
        storageUri: row.storageUri,
        hashSha256: row.hashSha256,
        addedAt: row.addedAt?.toISOString(),
      };
    });
  }

  async deleteEvidence(orgId: string, investigationId: string, evidenceId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(investigationEvidence)
        .where(and(
          eq(investigationEvidence.id, evidenceId),
          eq(investigationEvidence.investigationId, investigationId),
          eq(investigationEvidence.organizationId, orgId),
        ));
    });
  }

  async listEntities(orgId: string, investigationId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.#assertOwned(orgId, investigationId);
      const rows = await this.db
        .select()
        .from(investigationEntities)
        .where(and(eq(investigationEntities.investigationId, investigationId), eq(investigationEntities.organizationId, orgId)))
        .orderBy(desc(investigationEntities.addedAt));

      return rows.map((e) => ({
        id: e.id,
        entityType: e.entityType,
        entityValue: e.entityValue,
        notes: e.notes,
        addedAt: e.addedAt?.toISOString(),
      }));
    });
  }

  async addEntity(orgId: string, investigationId: string, addedBy: string, data: {
    entityType: string;
    entityValue: string;
    notes?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      await this.#assertOwned(orgId, investigationId);
      const [row] = await this.db.insert(investigationEntities).values({
        organizationId: orgId,
        investigationId,
        addedBy,
        entityType: data.entityType,
        entityValue: data.entityValue,
        notes: data.notes ?? null,
      }).returning();

      return {
        id: row.id,
        entityType: row.entityType,
        entityValue: row.entityValue,
        notes: row.notes,
        addedAt: row.addedAt?.toISOString(),
      };
    });
  }

  async deleteEntity(orgId: string, investigationId: string, entityId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(investigationEntities)
        .where(and(
          eq(investigationEntities.id, entityId),
          eq(investigationEntities.investigationId, investigationId),
          eq(investigationEntities.organizationId, orgId),
        ));
    });
  }
}

function mapNotebook(row: typeof investigationNotebooks.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    caseId: row.caseId,
    incidentId: row.incidentId,
    isPublished: row.isPublished,
    updatedAt: row.updatedAt?.toISOString(),
    createdAt: row.createdAt?.toISOString(),
  };
}
