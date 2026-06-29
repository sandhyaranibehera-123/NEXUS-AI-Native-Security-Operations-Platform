import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { policies } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class PoliciesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, category?: string) {
    return withTenant(this.db, orgId, async () => {
      const conditions = [eq(policies.organizationId, orgId)];
      if (category) conditions.push(eq(policies.category, category));

      const rows = await this.db
        .select()
        .from(policies)
        .where(and(...conditions))
        .orderBy(policies.category, desc(policies.violationCount));

      return rows.map((r) => this.#map(r));
    });
  }

  async toggle(orgId: string, id: string, isEnabled: boolean) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .update(policies)
        .set({ isEnabled, updatedAt: new Date() })
        .where(and(eq(policies.id, id), eq(policies.organizationId, orgId)))
        .returning();
      if (!row) return null;
      return this.#map(row);
    });
  }

  async create(orgId: string, data: {
    name: string;
    description?: string;
    category: string;
    severity?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .insert(policies)
        .values({
          organizationId: orgId,
          name: data.name,
          description: data.description ?? null,
          category: data.category,
          severity: data.severity ?? "medium",
          isEnabled: true,
          violationCount: 0,
        })
        .returning();
      return this.#map(row);
    });
  }

  async delete(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(policies)
        .where(and(eq(policies.id, id), eq(policies.organizationId, orgId)));
    });
  }

  #map(r: typeof policies.$inferSelect) {
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      category: r.category,
      severity: r.severity ?? "medium",
      isEnabled: r.isEnabled ?? true,
      violationCount: r.violationCount ?? 0,
      lastTriggeredAt: r.lastTriggeredAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    };
  }
}
