import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { alertSuppressionRules } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class SuppressionRulesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(alertSuppressionRules)
        .where(eq(alertSuppressionRules.organizationId, orgId))
        .orderBy(desc(alertSuppressionRules.createdAt));

      return rows.map((r) => this.#map(r));
    });
  }

  async create(orgId: string, data: { name: string; condition: string; createdBy?: string; expiresAt?: string }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .insert(alertSuppressionRules)
        .values({
          organizationId: orgId,
          name: data.name,
          condition: data.condition,
          createdBy: data.createdBy ?? null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          isActive: true,
        })
        .returning();
      return this.#map(row);
    });
  }

  async update(orgId: string, id: string, data: { name?: string; condition?: string; isActive?: boolean; expiresAt?: string | null }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof alertSuppressionRules.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (data.name !== undefined) updates.name = data.name;
      if (data.condition !== undefined) updates.condition = data.condition;
      if (data.isActive !== undefined) updates.isActive = data.isActive;
      if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

      const [row] = await this.db
        .update(alertSuppressionRules)
        .set(updates)
        .where(and(eq(alertSuppressionRules.id, id), eq(alertSuppressionRules.organizationId, orgId)))
        .returning();
      if (!row) return null;
      return this.#map(row);
    });
  }

  async delete(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(alertSuppressionRules)
        .where(and(eq(alertSuppressionRules.id, id), eq(alertSuppressionRules.organizationId, orgId)));
    });
  }

  #map(r: typeof alertSuppressionRules.$inferSelect) {
    return {
      id: r.id,
      name: r.name,
      condition: r.condition,
      createdBy: r.createdBy ?? "system",
      expiresAt: r.expiresAt?.toISOString() ?? null,
      isActive: r.isActive ?? true,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    };
  }
}
