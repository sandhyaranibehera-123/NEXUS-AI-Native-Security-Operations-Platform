import { eq } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { platformIntegrations } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class IntegrationsService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select()
        .from(platformIntegrations)
        .where(eq(platformIntegrations.organizationId, orgId));

      return rows.map((i) => ({
        id: i.id,
        provider: i.provider,
        displayName: i.displayName ?? i.provider,
        status: i.status,
        syncEnabled: i.syncEnabled,
        lastSyncAt: i.lastSyncAt?.toISOString(),
        lastError: i.lastError,
        eventsIngested: i.eventsIngested,
        config: i.config,
      }));
    });
  }
}
