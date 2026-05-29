import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import type { DbClient } from "@nexus/db";
import { apiKeys, webhooks } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class DeveloperService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listApiKeys(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          description: apiKeys.description,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          rateLimitRpm: apiKeys.rateLimitRpm,
          isActive: apiKeys.isActive,
          lastUsedAt: apiKeys.lastUsedAt,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.organizationId, orgId));

      return rows.map((k) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        rateLimitRpm: k.rateLimitRpm,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt?.toISOString(),
        expiresAt: k.expiresAt?.toISOString(),
        createdAt: k.createdAt?.toISOString(),
      }));
    });
  }

  async createApiKey(orgId: string, name: string, scopes: string[]) {
    const rawKey = `nx_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);

    const [row] = await withTenant(this.client, orgId, async () =>
      this.db.insert(apiKeys).values({
        organizationId: orgId,
        name,
        keyHash,
        keyPrefix,
        scopes,
      }).returning(),
    );

    return { ...row, key: rawKey };
  }

  async listWebhooks(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const rows = await this.db
        .select({
          id: webhooks.id,
          name: webhooks.name,
          endpointUrl: webhooks.endpointUrl,
          subscribedEvents: webhooks.subscribedEvents,
          isActive: webhooks.isActive,
          failureCount: webhooks.failureCount,
          createdAt: webhooks.createdAt,
        })
        .from(webhooks)
        .where(eq(webhooks.organizationId, orgId));

      return rows;
    });
  }
}
