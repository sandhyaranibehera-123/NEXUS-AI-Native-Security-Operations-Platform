import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { notificationChannels } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { assertSafeUrl } from "../../lib/ssrf-guard.js";

export interface NotificationChannelInput {
  name: string;
  type: string;
  target: string;
  config?: Record<string, unknown>;
  createdBy?: string;
}

export class NotificationChannelsService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.organizationId, orgId))
        .orderBy(desc(notificationChannels.createdAt));
      return rows.map((r) => this.#map(r));
    });
  }

  async create(orgId: string, data: NotificationChannelInput) {
    if (data.type === "webhook") assertSafeUrl(data.target);
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .insert(notificationChannels)
        .values({
          organizationId: orgId,
          name: data.name,
          type: data.type,
          target: data.target,
          config: data.config ?? {},
          createdBy: data.createdBy ?? null,
          isActive: true,
        })
        .returning();
      return this.#map(row);
    });
  }

  async update(orgId: string, id: string, data: Partial<NotificationChannelInput> & { isActive?: boolean }) {
    if (data.type === "webhook" && data.target) assertSafeUrl(data.target);
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof notificationChannels.$inferInsert> = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.type !== undefined) updates.type = data.type;
      if (data.target !== undefined) updates.target = data.target;
      if (data.config !== undefined) updates.config = data.config;
      if (data.isActive !== undefined) updates.isActive = data.isActive;

      const [row] = await this.db
        .update(notificationChannels)
        .set(updates)
        .where(and(eq(notificationChannels.id, id), eq(notificationChannels.organizationId, orgId)))
        .returning();
      if (!row) return null;
      return this.#map(row);
    });
  }

  async delete(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(notificationChannels)
        .where(and(eq(notificationChannels.id, id), eq(notificationChannels.organizationId, orgId)));
    });
  }

  #map(r: typeof notificationChannels.$inferSelect) {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      target: r.target,
      config: (r.config as Record<string, unknown>) ?? {},
      isActive: r.isActive ?? true,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    };
  }
}
