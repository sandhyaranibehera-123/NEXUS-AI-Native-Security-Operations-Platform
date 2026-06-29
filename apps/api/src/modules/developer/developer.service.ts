import { eq, and, desc } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import type { DbClient } from "@nexus/db";
import { apiKeys, webhooks, webhookDeliveries } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";
import { safeFetch } from "../../lib/ssrf-guard.js";

export class DeveloperService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listApiKeys(orgId: string) {
    return withTenant(this.db, orgId, async () => {
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

    const [row] = await withTenant(this.db, orgId, async () =>
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
    return withTenant(this.db, orgId, async () => {
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

  async deleteApiKey(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, orgId)));
    });
  }

  async createWebhook(orgId: string, name: string, endpointUrl: string, events: string[]) {
    const secret = randomBytes(16).toString("hex");
    const [row] = await withTenant(this.db, orgId, async () =>
      this.db.insert(webhooks).values({
        organizationId: orgId,
        name,
        endpointUrl,
        secretKey: secret,
        subscribedEvents: events,
      }).returning(),
    );
    return row;
  }

  async deleteWebhook(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, orgId)));
    });
  }

  async updateWebhook(orgId: string, id: string, data: {
    name?: string;
    endpointUrl?: string;
    subscribedEvents?: string[];
    isActive?: boolean;
  }) {
    return withTenant(this.db, orgId, async () => {
      const updates: Partial<typeof webhooks.$inferInsert> = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.endpointUrl !== undefined) updates.endpointUrl = data.endpointUrl;
      if (data.subscribedEvents !== undefined) updates.subscribedEvents = data.subscribedEvents;
      if (data.isActive !== undefined) updates.isActive = data.isActive;

      const [row] = await this.db
        .update(webhooks)
        .set(updates)
        .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Webhook not found");
      return row;
    });
  }

  async testWebhook(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [hook] = await this.db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, orgId)))
        .limit(1);
      if (!hook) throw new NotFoundError("Webhook not found");

      const payload = { event: "webhook.test", sentAt: new Date().toISOString(), webhookId: hook.id };
      const start = Date.now();
      let statusCode = 0;
      let responseBody = "";
      try {
        const resp = await safeFetch(hook.endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Nexus-Event": "webhook.test" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        statusCode = resp.status;
        responseBody = await resp.text().catch(() => "");
      } catch (err) {
        responseBody = String(err instanceof Error ? err.message : err);
      }
      const success = statusCode >= 200 && statusCode < 300;
      const deliveryTimeMs = Date.now() - start;

      const [delivery] = await this.db.insert(webhookDeliveries).values({
        webhookId: hook.id,
        eventType: "webhook.test",
        payload,
        responseStatus: statusCode || null,
        responseBody: responseBody.slice(0, 500),
        deliveryTimeMs,
        success,
      }).returning();

      return {
        id: delivery.id,
        success,
        responseStatus: statusCode || null,
        responseBody: responseBody.slice(0, 500),
        deliveryTimeMs,
      };
    });
  }

  async listDeliveries(orgId: string, webhookId: string) {
    return withTenant(this.db, orgId, async () => {
      const [hook] = await this.db
        .select({ id: webhooks.id })
        .from(webhooks)
        .where(and(eq(webhooks.id, webhookId), eq(webhooks.organizationId, orgId)))
        .limit(1);
      if (!hook) throw new NotFoundError("Webhook not found");

      const rows = await this.db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId))
        .orderBy(desc(webhookDeliveries.deliveredAt))
        .limit(50);

      return rows.map((d) => ({
        id: d.id,
        eventType: d.eventType,
        responseStatus: d.responseStatus,
        deliveryTimeMs: d.deliveryTimeMs,
        retryCount: d.retryCount ?? 0,
        success: d.success ?? false,
        deliveredAt: d.deliveredAt?.toISOString(),
      }));
    });
  }
}
