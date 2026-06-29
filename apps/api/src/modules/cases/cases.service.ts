import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { cases, users, auditLogs, caseEvidence, caseTasks, caseActivity, caseWatchers } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

function mapCase(c: typeof cases.$inferSelect, ownerName: string | null) {
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    title: c.title,
    description: c.description,
    status: c.status,
    priority: c.priority,
    owner: ownerName ?? "Unassigned",
    ownerId: c.ownerId,
    tags: (c.tags as string[]) ?? [],
    createdAt: c.createdAt?.toISOString(),
    updatedAt: c.updatedAt?.toISOString(),
  };
}

export class CasesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, filters: { search?: string; status?: string } = {}) {
    return withTenant(this.db, orgId, async () => {
      const conditions = [eq(cases.organizationId, orgId)];
      if (filters.status) conditions.push(sql`${cases.status} = ${filters.status}`);
      if (filters.search) {
        const term = `%${filters.search}%`;
        conditions.push(or(ilike(cases.title, term), ilike(cases.caseNumber, term))!);
      }

      const rows = await this.db
        .select({ case: cases, ownerName: users.fullName })
        .from(cases)
        .leftJoin(users, eq(cases.ownerId, users.id))
        .where(and(...conditions))
        .orderBy(desc(cases.updatedAt))
        .limit(100);

      return rows.map(({ case: c, ownerName }) => mapCase(c, ownerName));
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .select({ case: cases, ownerName: users.fullName })
        .from(cases)
        .leftJoin(users, eq(cases.ownerId, users.id))
        .where(and(eq(cases.id, id), eq(cases.organizationId, orgId)))
        .limit(1);
      if (!row) return null;
      return mapCase(row.case, row.ownerName);
    });
  }

  async create(orgId: string, userId: string, data: { title: string; description?: string; priority?: string; tags?: string[] }) {
    return withTenant(this.db, orgId, async () => {
      const count = await this.db.$count(cases, eq(cases.organizationId, orgId));
      const caseNumber = `CASE-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const [row] = await this.db.insert(cases).values({
        organizationId: orgId,
        ownerId: userId,
        caseNumber,
        title: data.title,
        description: data.description,
        status: "open",
        priority: (data.priority ?? "medium") as "low" | "medium" | "high" | "critical",
        tags: data.tags ?? [],
      }).returning();
      return mapCase(row, null);
    });
  }

  async update(
    orgId: string,
    id: string,
    data: { title?: string; description?: string; status?: string; priority?: string; ownerId?: string; tags?: string[] },
    actor?: { id: string; email: string },
  ) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof cases.$inferInsert> = { updatedAt: new Date() };
      if (data.title !== undefined) updates.title = data.title;
      if (data.description !== undefined) updates.description = data.description;
      if (data.status !== undefined) {
        updates.status = data.status as "open" | "in_progress" | "review" | "closed";
        if (data.status === "closed") updates.closedAt = new Date();
      }
      if (data.priority !== undefined) updates.priority = data.priority as "low" | "medium" | "high" | "critical";
      if (data.ownerId !== undefined) updates.ownerId = data.ownerId;
      if (data.tags !== undefined) updates.tags = data.tags;

      const [row] = await this.db
        .update(cases)
        .set(updates)
        .where(and(eq(cases.id, id), eq(cases.organizationId, orgId)))
        .returning();
      if (!row) return null;

      if (actor) {
        const action = data.ownerId !== undefined
          ? "case.reassign"
          : data.status !== undefined
            ? "case.status_change"
            : "case.update";
        await this.db.insert(auditLogs).values({
          organizationId: orgId,
          userId: actor.id,
          userEmail: actor.email,
          action,
          resourceType: "case",
          resourceId: row.id,
        });
        if (data.status !== undefined) {
          await this.db.insert(caseActivity).values({
            organizationId: orgId,
            caseId: row.id,
            actorId: actor.id,
            actionType: "status_change",
            description: `Status changed to ${data.status}`,
          });
        }
      }

      const [owner] = row.ownerId
        ? await this.db.select({ fullName: users.fullName }).from(users).where(eq(users.id, row.ownerId)).limit(1)
        : [{ fullName: null as string | null }];
      return mapCase(row, owner?.fullName ?? null);
    });
  }

  async delete(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db.delete(cases).where(and(eq(cases.id, id), eq(cases.organizationId, orgId)));
    });
  }

  async #logActivity(orgId: string, caseId: string, actor: { id?: string; name?: string }, actionType: string, description: string) {
    await this.db.insert(caseActivity).values({
      organizationId: orgId,
      caseId,
      actorId: actor.id ?? null,
      actorName: actor.name ?? null,
      actionType,
      description,
    });
  }

  async listEvidence(orgId: string, caseId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(caseEvidence)
        .where(and(eq(caseEvidence.caseId, caseId), eq(caseEvidence.organizationId, orgId)))
        .orderBy(desc(caseEvidence.addedAt));
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

  async addEvidence(orgId: string, caseId: string, actor: { id: string; name: string }, data: {
    type: string; title: string; description?: string; fileName?: string; mimeType?: string; storageUri?: string; hashSha256?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(caseEvidence).values({
        organizationId: orgId,
        caseId,
        addedBy: actor.id,
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        fileName: data.fileName ?? null,
        mimeType: data.mimeType ?? null,
        storageUri: data.storageUri ?? null,
        hashSha256: data.hashSha256 ?? null,
      }).returning();
      await this.#logActivity(orgId, caseId, actor, "evidence_added", `Evidence added: ${data.title}`);
      return {
        id: row.id, type: row.type, title: row.title, description: row.description,
        fileName: row.fileName, mimeType: row.mimeType, storageUri: row.storageUri,
        hashSha256: row.hashSha256, addedAt: row.addedAt?.toISOString(),
      };
    });
  }

  async deleteEvidence(orgId: string, caseId: string, evidenceId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(caseEvidence)
        .where(and(eq(caseEvidence.id, evidenceId), eq(caseEvidence.caseId, caseId), eq(caseEvidence.organizationId, orgId)));
    });
  }

  async listTasks(orgId: string, caseId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(caseTasks)
        .where(and(eq(caseTasks.caseId, caseId), eq(caseTasks.organizationId, orgId)))
        .orderBy(desc(caseTasks.createdAt));
      return rows.map(mapTask);
    });
  }

  async createTask(orgId: string, caseId: string, actor: { id: string; name: string }, data: {
    title: string; description?: string; assigneeId?: string; dueDate?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(caseTasks).values({
        organizationId: orgId,
        caseId,
        createdBy: actor.id,
        title: data.title,
        description: data.description ?? null,
        assigneeId: data.assigneeId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: "open",
      }).returning();
      await this.#logActivity(orgId, caseId, actor, "task_created", `Task created: ${data.title}`);
      return mapTask(row);
    });
  }

  async updateTask(orgId: string, caseId: string, taskId: string, actor: { id: string; name: string }, data: {
    title?: string; description?: string; status?: string; assigneeId?: string; dueDate?: string | null;
  }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof caseTasks.$inferInsert> = { updatedAt: new Date() };
      if (data.title !== undefined) updates.title = data.title;
      if (data.description !== undefined) updates.description = data.description;
      if (data.status !== undefined) {
        updates.status = data.status;
        updates.completedAt = data.status === "done" ? new Date() : null;
      }
      if (data.assigneeId !== undefined) updates.assigneeId = data.assigneeId;
      if (data.dueDate !== undefined) updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;

      const [row] = await this.db
        .update(caseTasks)
        .set(updates)
        .where(and(eq(caseTasks.id, taskId), eq(caseTasks.caseId, caseId), eq(caseTasks.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Task not found");
      if (data.status !== undefined) {
        await this.#logActivity(orgId, caseId, actor, "task_status_change", `Task "${row.title}" marked ${data.status}`);
      }
      return mapTask(row);
    });
  }

  async deleteTask(orgId: string, caseId: string, taskId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(caseTasks)
        .where(and(eq(caseTasks.id, taskId), eq(caseTasks.caseId, caseId), eq(caseTasks.organizationId, orgId)));
    });
  }

  async listActivity(orgId: string, caseId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(caseActivity)
        .where(and(eq(caseActivity.caseId, caseId), eq(caseActivity.organizationId, orgId)))
        .orderBy(desc(caseActivity.createdAt))
        .limit(100);
      return rows.map((a) => ({
        id: a.id,
        actorName: a.actorName ?? "System",
        actionType: a.actionType,
        description: a.description,
        createdAt: a.createdAt?.toISOString(),
      }));
    });
  }

  async listWatchers(orgId: string, caseId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({ userId: caseWatchers.userId, fullName: users.fullName, email: users.email, addedAt: caseWatchers.addedAt })
        .from(caseWatchers)
        .innerJoin(users, eq(caseWatchers.userId, users.id))
        .where(eq(caseWatchers.caseId, caseId));
      return rows.map((w) => ({
        userId: w.userId,
        name: w.fullName,
        email: w.email,
        addedAt: w.addedAt?.toISOString(),
      }));
    });
  }

  async addWatcher(orgId: string, caseId: string, userId: string) {
    return withTenant(this.db, orgId, async () => {
      const [caseRow] = await this.db
        .select({ id: cases.id })
        .from(cases)
        .where(and(eq(cases.id, caseId), eq(cases.organizationId, orgId)))
        .limit(1);
      if (!caseRow) throw new NotFoundError("Case not found");

      await this.db.insert(caseWatchers).values({ caseId, userId }).onConflictDoNothing();
      return { watching: true };
    });
  }

  async removeWatcher(orgId: string, caseId: string, userId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(caseWatchers)
        .where(and(eq(caseWatchers.caseId, caseId), eq(caseWatchers.userId, userId)));
      return { watching: false };
    });
  }
}

function mapTask(t: typeof caseTasks.$inferSelect) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status ?? "open",
    assigneeId: t.assigneeId,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt?.toISOString(),
    updatedAt: t.updatedAt?.toISOString(),
  };
}
