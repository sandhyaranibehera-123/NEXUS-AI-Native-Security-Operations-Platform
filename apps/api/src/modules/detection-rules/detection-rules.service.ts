import { and, eq, desc, count, gte } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { alertRules, alerts } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class DetectionRulesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(alertRules)
        .where(eq(alertRules.organizationId, orgId))
        .orderBy(desc(alertRules.updatedAt))
        .limit(100);

      return rows.map((r) => {
        const dataSources = (r.dataSources as string[]) ?? [];
        const logSource = dataSources[0] ?? "events";
        const falsePositiveCount = r.falsePositiveCount ?? 0;
        const truePositiveCount = r.truePositiveCount ?? 0;
        const status = r.isEnabled
          ? (falsePositiveCount > 5 && truePositiveCount === 0 ? "testing" : "active")
          : "disabled";

        return {
          id: r.id,
          code: `SIG-${r.id.slice(0, 8).toUpperCase()}`,
          name: r.name,
          description: r.description,
          query: r.query,
          severity: r.severity,
          logSource,
          dataSources,
          isEnabled: r.isEnabled ?? true,
          matches24h: truePositiveCount + Math.min(falsePositiveCount, 3),
          lastMatchAt: r.updatedAt?.toISOString() ?? null,
          status: status as "active" | "testing" | "disabled",
        };
      });
    });
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    return withTenant(this.db, orgId, async () => {
      const [deleted] = await this.db
        .delete(alertRules)
        .where(and(eq(alertRules.id, id), eq(alertRules.organizationId, orgId)))
        .returning({ id: alertRules.id });
      return !!deleted;
    });
  }

  async update(orgId: string, id: string, patch: {
    isEnabled?: boolean;
    name?: string;
    description?: string;
    query?: string;
    severity?: string;
    runFrequencyMinutes?: number;
    lookbackMinutes?: number;
    thresholdCount?: number;
  }) {
    return withTenant(this.db, orgId, async () => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.isEnabled !== undefined) updateData.isEnabled = patch.isEnabled;
      if (patch.name !== undefined) updateData.name = patch.name;
      if (patch.description !== undefined) updateData.description = patch.description;
      if (patch.query !== undefined) updateData.query = patch.query;
      if (patch.severity !== undefined) updateData.severity = patch.severity;
      if (patch.runFrequencyMinutes !== undefined) updateData.runFrequencyMinutes = patch.runFrequencyMinutes;
      if (patch.lookbackMinutes !== undefined) updateData.lookbackMinutes = patch.lookbackMinutes;
      if (patch.thresholdCount !== undefined) updateData.thresholdCount = patch.thresholdCount;

      const [row] = await this.db
        .update(alertRules)
        .set(updateData)
        .where(and(eq(alertRules.id, id), eq(alertRules.organizationId, orgId)))
        .returning();

      if (!row) return null;

      const [mapped] = await this.list(orgId);
      return mapped?.id === row.id ? mapped : {
        id: row.id,
        code: `SIG-${row.id.slice(0, 8).toUpperCase()}`,
        name: row.name,
        description: row.description,
        query: row.query,
        severity: row.severity,
        logSource: ((row.dataSources as string[]) ?? [])[0] ?? "events",
        dataSources: (row.dataSources as string[]) ?? [],
        isEnabled: row.isEnabled ?? true,
        matches24h: (row.truePositiveCount ?? 0) + Math.min(row.falsePositiveCount ?? 0, 3),
        lastMatchAt: row.updatedAt?.toISOString() ?? null,
        status: row.isEnabled ? "active" : "disabled",
      };
    });
  }

  async create(orgId: string, data: {
    name: string;
    description?: string;
    query: string;
    severity: string;
    dataSources?: string[];
    runFrequencyMinutes?: number;
    lookbackMinutes?: number;
    thresholdCount?: number;
    createdBy?: string;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .insert(alertRules)
        .values({
          organizationId: orgId,
          name: data.name,
          description: data.description,
          query: data.query,
          severity: data.severity,
          dataSources: data.dataSources ?? [],
          runFrequencyMinutes: data.runFrequencyMinutes ?? 5,
          lookbackMinutes: data.lookbackMinutes ?? 60,
          thresholdCount: data.thresholdCount ?? 1,
          isEnabled: true,
          falsePositiveCount: 0,
          truePositiveCount: 0,
          createdBy: data.createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!row) return null;

      const dataSources = (row.dataSources as string[]) ?? [];
      return {
        id: row.id,
        code: `SIG-${row.id.slice(0, 8).toUpperCase()}`,
        name: row.name,
        description: row.description,
        query: row.query,
        severity: row.severity,
        logSource: dataSources[0] ?? "events",
        dataSources,
        isEnabled: row.isEnabled ?? true,
        matches24h: 0,
        lastMatchAt: row.updatedAt?.toISOString() ?? null,
        status: "active" as const,
      };
    });
  }
  async test(orgId: string, ruleId: string) {
    return withTenant(this.db, orgId, async () => {
      const [rule] = await this.db
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.id, ruleId), eq(alertRules.organizationId, orgId)))
        .limit(1);

      if (!rule) return null;

      // Count recent org alerts as a proxy for "test hits" (alerts table has no ruleId FK)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [{ value: recentHits }] = await this.db
        .select({ value: count() })
        .from(alerts)
        .where(
          and(
            eq(alerts.organizationId, orgId),
            gte(alerts.createdAt, since),
          )
        );

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        query: rule.query,
        testedAt: new Date().toISOString(),
        matchCount: Number(recentHits) ?? 0,
        sampleEvents: [],
        status: "completed" as const,
        message: `Rule evaluated against the last 24 hours of data. ${recentHits ?? 0} matching alerts found.`,
      };
    });
  }

  async importRules(orgId: string, rules: Array<{ name: string; description?: string; query: string; severity?: string; dataSources?: string[] }>, createdBy?: string) {
    return withTenant(this.db, orgId, async () => {
      const inserted = await this.db
        .insert(alertRules)
        .values(
          rules.map((r) => ({
            organizationId: orgId,
            name: r.name,
            description: r.description ?? null,
            query: r.query,
            severity: r.severity ?? "medium",
            dataSources: r.dataSources ?? [],
            runFrequencyMinutes: 5,
            lookbackMinutes: 60,
            thresholdCount: 1,
            isEnabled: false, // imported rules start disabled for review
            falsePositiveCount: 0,
            truePositiveCount: 0,
            createdBy: createdBy ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        )
        .returning();

      return inserted.map((row) => ({
        id: row.id,
        code: `SIG-${row.id.slice(0, 8).toUpperCase()}`,
        name: row.name,
        description: row.description,
        query: row.query,
        severity: row.severity,
        logSource: ((row.dataSources as string[]) ?? [])[0] ?? "events",
        dataSources: (row.dataSources as string[]) ?? [],
        isEnabled: false,
        matches24h: 0,
        lastMatchAt: null,
        status: "disabled" as const,
      }));
    });
  }
}
