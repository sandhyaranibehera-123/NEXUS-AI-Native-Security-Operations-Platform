import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { escalationPolicies } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export interface EscalationStep {
  order: number;
  delayMinutes: number;
  channelId?: string | null;
  notifyRole?: string;
}

export interface EscalationPolicyInput {
  name: string;
  description?: string;
  steps?: EscalationStep[];
  createdBy?: string;
}

export class EscalationPoliciesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(escalationPolicies)
        .where(eq(escalationPolicies.organizationId, orgId))
        .orderBy(desc(escalationPolicies.createdAt));
      return rows.map((r) => this.#map(r));
    });
  }

  async create(orgId: string, data: EscalationPolicyInput) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .insert(escalationPolicies)
        .values({
          organizationId: orgId,
          name: data.name,
          description: data.description ?? null,
          steps: data.steps ?? [],
          createdBy: data.createdBy ?? null,
          isActive: true,
        })
        .returning();
      return this.#map(row);
    });
  }

  async update(orgId: string, id: string, data: Partial<EscalationPolicyInput> & { isActive?: boolean }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof escalationPolicies.$inferInsert> = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.steps !== undefined) updates.steps = data.steps;
      if (data.isActive !== undefined) updates.isActive = data.isActive;

      const [row] = await this.db
        .update(escalationPolicies)
        .set(updates)
        .where(and(eq(escalationPolicies.id, id), eq(escalationPolicies.organizationId, orgId)))
        .returning();
      if (!row) return null;
      return this.#map(row);
    });
  }

  async delete(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(escalationPolicies)
        .where(and(eq(escalationPolicies.id, id), eq(escalationPolicies.organizationId, orgId)));
    });
  }

  #map(r: typeof escalationPolicies.$inferSelect) {
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      steps: (r.steps as EscalationStep[]) ?? [],
      isActive: r.isActive ?? true,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    };
  }
}
