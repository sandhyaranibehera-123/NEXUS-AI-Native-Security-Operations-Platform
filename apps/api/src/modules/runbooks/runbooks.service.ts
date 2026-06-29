import { eq, and, sql, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { runbooks, runbookSteps, runbookExecutions } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

function mapRunbook(r: typeof runbooks.$inferSelect, steps: typeof runbookSteps.$inferSelect[]) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    isAutomated: r.isAutomated,
    isEnabled: r.isEnabled,
    executionCount: r.executionCount ?? 0,
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
    steps: steps.map((s) => ({
      id: s.id,
      order: s.stepOrder,
      name: s.name,
      actionType: s.actionType,
      isManual: s.isManual,
      config: s.actionPayload,
    })),
  };
}

export class RunbooksService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(runbooks)
        .where(eq(runbooks.organizationId, orgId))
        .orderBy(desc(runbooks.updatedAt));

      return Promise.all(rows.map(async (r) => {
        const steps = await this.db
          .select()
          .from(runbookSteps)
          .where(eq(runbookSteps.runbookId, r.id))
          .orderBy(runbookSteps.stepOrder);
        return mapRunbook(r, steps);
      }));
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [r] = await this.db
        .select()
        .from(runbooks)
        .where(and(eq(runbooks.id, id), eq(runbooks.organizationId, orgId)))
        .limit(1);
      if (!r) return null;
      const steps = await this.db
        .select()
        .from(runbookSteps)
        .where(eq(runbookSteps.runbookId, r.id))
        .orderBy(runbookSteps.stepOrder);
      return mapRunbook(r, steps);
    });
  }

  async create(orgId: string, createdBy: string, data: {
    name: string;
    description?: string;
    category?: string;
    steps?: Array<{
      stepOrder: number;
      title: string;
      description?: string;
      stepType?: string;
      config?: Record<string, unknown>;
      isRequired?: boolean;
    }>;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [r] = await this.db.insert(runbooks).values({
        organizationId: orgId,
        createdBy,
        name: data.name,
        description: data.description,
        category: data.category,
        isAutomated: false,
        isEnabled: true,
        executionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      if (data.steps?.length) {
        await this.db.insert(runbookSteps).values(
          data.steps.map((s) => ({
            runbookId: r.id,
            stepOrder: s.stepOrder,
            name: s.title,
            description: s.description,
            actionType: s.stepType ?? "manual",
            actionPayload: s.config ?? {},
            isManual: !s.stepType || s.stepType === "manual",
          })),
        );
      }

      return this.getById(orgId, r.id);
    });
  }

  async update(orgId: string, id: string, data: {
    name?: string;
    description?: string;
    category?: string;
    isActive?: boolean;
  }) {
    return withTenant(this.db, orgId, async () => {
      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.category !== undefined) updateFields.category = data.category;
      if (data.isActive !== undefined) updateFields.isEnabled = data.isActive;

      const [r] = await this.db
        .update(runbooks)
        .set(updateFields)
        .where(and(eq(runbooks.id, id), eq(runbooks.organizationId, orgId)))
        .returning();
      if (!r) return null;
      return this.getById(orgId, r.id);
    });
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    return withTenant(this.db, orgId, async () => {
      const [deleted] = await this.db
        .delete(runbooks)
        .where(and(eq(runbooks.id, id), eq(runbooks.organizationId, orgId)))
        .returning({ id: runbooks.id });
      return !!deleted;
    });
  }

  async assign(orgId: string, id: string, assignee: string, priority: string) {
    return withTenant(this.db, orgId, async () => {
      const [runbook] = await this.db
        .select()
        .from(runbooks)
        .where(and(eq(runbooks.id, id), eq(runbooks.organizationId, orgId)))
        .limit(1);

      if (!runbook) return null;

      await this.db
        .update(runbooks)
        .set({ executionCount: sql`${runbooks.executionCount} + 1`, updatedAt: new Date() })
        .where(eq(runbooks.id, id));

      return {
        id: `asg-${Date.now()}`,
        runbookId: id,
        runbookName: runbook.name,
        assignee,
        priority,
        status: "assigned",
        assignedAt: new Date().toISOString(),
      };
    });
  }

  async execute(orgId: string, id: string, triggeredBy: string, opts: {
    incidentId?: string;
    context?: Record<string, unknown>;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [runbook] = await this.db
        .select()
        .from(runbooks)
        .where(and(eq(runbooks.id, id), eq(runbooks.organizationId, orgId)))
        .limit(1);
      if (!runbook) return null;

      const [execution] = await this.db.insert(runbookExecutions).values({
        runbookId: id,
        triggeredBy,
        incidentId: opts.incidentId,
        status: "running",
        startedAt: new Date(),
        stepResults: opts.context ? [{ context: opts.context }] : [],
      }).returning();

      await this.db
        .update(runbooks)
        .set({ executionCount: sql`${runbooks.executionCount} + 1`, updatedAt: new Date() })
        .where(eq(runbooks.id, id));

      return {
        executionId: execution.id,
        runbookId: id,
        runbookName: runbook.name,
        status: "running",
        startedAt: execution.startedAt?.toISOString(),
      };
    });
  }

  async listExecutions(orgId: string, runbookId: string) {
    return withTenant(this.db, orgId, async () => {
      const [runbook] = await this.db
        .select({ id: runbooks.id })
        .from(runbooks)
        .where(and(eq(runbooks.id, runbookId), eq(runbooks.organizationId, orgId)))
        .limit(1);
      if (!runbook) return [];

      const rows = await this.db
        .select()
        .from(runbookExecutions)
        .where(eq(runbookExecutions.runbookId, runbookId))
        .orderBy(desc(runbookExecutions.startedAt))
        .limit(50);

      return rows.map((e) => ({
        id: e.id,
        status: e.status,
        triggeredBy: e.triggeredBy,
        startedAt: e.startedAt?.toISOString(),
        completedAt: e.completedAt?.toISOString(),
        durationMs: e.completedAt && e.startedAt
          ? e.completedAt.getTime() - e.startedAt.getTime()
          : null,
        log: e.logOutput,
      }));
    });
  }
}
