import { eq, and, asc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { routingRules } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export interface RoutingRuleInput {
  name: string;
  conditions?: Record<string, unknown>;
  channelId?: string | null;
  priority?: number;
}

export class RoutingRulesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(routingRules)
        .where(eq(routingRules.organizationId, orgId))
        .orderBy(asc(routingRules.priority));
      return rows.map((r) => this.#map(r));
    });
  }

  async create(orgId: string, data: RoutingRuleInput) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .insert(routingRules)
        .values({
          organizationId: orgId,
          name: data.name,
          conditions: data.conditions ?? {},
          channelId: data.channelId ?? null,
          priority: data.priority ?? 100,
          isActive: true,
        })
        .returning();
      return this.#map(row);
    });
  }

  async update(orgId: string, id: string, data: Partial<RoutingRuleInput> & { isActive?: boolean }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof routingRules.$inferInsert> = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.conditions !== undefined) updates.conditions = data.conditions;
      if (data.channelId !== undefined) updates.channelId = data.channelId;
      if (data.priority !== undefined) updates.priority = data.priority;
      if (data.isActive !== undefined) updates.isActive = data.isActive;

      const [row] = await this.db
        .update(routingRules)
        .set(updates)
        .where(and(eq(routingRules.id, id), eq(routingRules.organizationId, orgId)))
        .returning();
      if (!row) return null;
      return this.#map(row);
    });
  }

  async delete(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(routingRules)
        .where(and(eq(routingRules.id, id), eq(routingRules.organizationId, orgId)));
    });
  }

  #map(r: typeof routingRules.$inferSelect) {
    return {
      id: r.id,
      name: r.name,
      conditions: (r.conditions as Record<string, unknown>) ?? {},
      channelId: r.channelId ?? null,
      priority: r.priority ?? 100,
      isActive: r.isActive ?? true,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    };
  }
}
