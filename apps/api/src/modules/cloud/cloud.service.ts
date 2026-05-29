import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { cloudAccounts, cloudAssets, cloudIamFindings } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class CloudService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listAccounts(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const accounts = await this.db
        .select()
        .from(cloudAccounts)
        .where(eq(cloudAccounts.organizationId, orgId));

      return Promise.all(accounts.map(async (a) => {
        const findings = await this.db
          .select()
          .from(cloudIamFindings)
          .where(and(eq(cloudIamFindings.cloudAccountId, a.id), eq(cloudIamFindings.isResolved, false)))
          .limit(5);

        const assets = await this.db
          .select()
          .from(cloudAssets)
          .where(eq(cloudAssets.cloudAccountId, a.id))
          .limit(10);

        return {
          id: a.id,
          provider: a.provider,
          accountId: a.accountId,
          alias: a.accountAlias,
          syncStatus: a.syncStatus,
          lastSyncAt: a.lastSyncAt?.toISOString(),
          totalAssets: a.totalAssets,
          riskScore: a.riskScore,
          regions: (a.regions as string[]) ?? [],
          findings: findings.map((f) => ({
            id: f.id,
            type: f.findingType,
            principal: f.principalName,
            risk: f.riskLevel,
            description: f.description,
          })),
          assets: assets.map((as) => ({
            id: as.id,
            type: as.assetType,
            name: as.assetName,
            region: as.region,
            isPublic: as.isPublic,
            riskScore: as.riskScore,
          })),
        };
      }));
    });
  }

  async summary(orgId: string) {
    const accounts = await this.listAccounts(orgId);
    return {
      accountCount: accounts.length,
      totalAssets: accounts.reduce((s, a) => s + (a.totalAssets ?? 0), 0),
      avgRisk: accounts.length
        ? Math.round(accounts.reduce((s, a) => s + (a.riskScore ?? 0), 0) / accounts.length)
        : 0,
      openFindings: accounts.reduce((s, a) => s + a.findings.length, 0),
      accounts,
    };
  }
}
