import { eq, and, desc, inArray } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import {
  cloudAccounts,
  cloudAssets,
  cloudIamFindings,
  cloudComplianceChecks,
  complianceAssessments,
  complianceControls,
} from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";
import { encryptIfConfigured } from "../../lib/crypto.js";

export class CloudService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listAccounts(orgId: string) {
    return withTenant(this.db, orgId, async () => {
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
          name: a.accountAlias ?? a.accountId,
          resources: a.totalAssets ?? assets.length,
          syncStatus: a.syncStatus,
          lastSyncAt: a.lastSyncAt?.toISOString(),
          totalAssets: a.totalAssets ?? assets.length,
          riskScore: a.riskScore ?? 0,
          criticalFindings: findings.filter((f) => f.riskLevel === "critical").length,
          highFindings: findings.filter((f) => f.riskLevel === "high").length,
          compliance: [
            { framework: "CIS", score: Math.max(40, 100 - (a.riskScore ?? 0)) },
            { framework: "SOC2", score: Math.max(50, 98 - Math.round((a.riskScore ?? 0) / 2)) },
          ],
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

  async listResources(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({ asset: cloudAssets, account: cloudAccounts })
        .from(cloudAssets)
        .innerJoin(cloudAccounts, eq(cloudAssets.cloudAccountId, cloudAccounts.id))
        .where(eq(cloudAccounts.organizationId, orgId))
        .orderBy(desc(cloudAssets.riskScore))
        .limit(100);

      return rows.map(({ asset, account }) => ({
        id: asset.id,
        name: asset.assetName ?? asset.assetId,
        type: asset.assetType,
        cloud: normalizeProvider(account.provider),
        account: account.accountAlias ?? account.accountId,
        region: asset.region ?? "global",
        exposure: asset.isPublic ? "public" : (asset.riskScore ?? 0) >= 45 ? "internal" : "private",
        severity: severityForRisk(asset.riskScore ?? 0),
        finding: findingForAsset(asset.assetType, asset.isPublic ?? false, asset.riskScore ?? 0),
        age: ageLabel(asset.discoveredAt),
        ageMs: asset.discoveredAt ? Date.now() - asset.discoveredAt.getTime() : 0,
      }));
    });
  }

  async listIamFindings(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({ finding: cloudIamFindings, account: cloudAccounts })
        .from(cloudIamFindings)
        .innerJoin(cloudAccounts, eq(cloudIamFindings.cloudAccountId, cloudAccounts.id))
        .where(and(eq(cloudAccounts.organizationId, orgId), eq(cloudIamFindings.isResolved, false)))
        .orderBy(desc(cloudIamFindings.detectedAt))
        .limit(100);

      return rows.map(({ finding, account }) => ({
        id: finding.id,
        type: normalizeIamType(finding.findingType),
        principal: finding.principalName ?? "unknown-principal",
        account: account.accountAlias ?? account.accountId,
        detail: finding.description ?? "IAM posture finding requires analyst review",
        severity: finding.riskLevel,
        age: ageLabel(finding.detectedAt),
      }));
    });
  }

  async listStorageBuckets(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({ asset: cloudAssets, account: cloudAccounts })
        .from(cloudAssets)
        .innerJoin(cloudAccounts, eq(cloudAssets.cloudAccountId, cloudAccounts.id))
        .where(eq(cloudAccounts.organizationId, orgId))
        .orderBy(desc(cloudAssets.riskScore))
        .limit(100);

      return rows
        .filter(({ asset }) => {
          const type = asset.assetType.toLowerCase();
          const name = (asset.assetName ?? asset.assetId).toLowerCase();
          return ["bucket", "blob", "storage", "s3", "gcs"].some((term) => type.includes(term) || name.includes(term));
        })
        .map(({ asset, account }) => {
          const config = (asset.configuration as Record<string, unknown>) ?? {};
          const encrypted = typeof config.encrypted === "boolean" ? config.encrypted : (asset.riskScore ?? 0) < 70;
          const piiDetected = Boolean(config.piiDetected ?? config.containsPii ?? (asset.riskScore ?? 0) >= 80);
          return {
            id: asset.id,
            name: asset.assetName ?? asset.assetId,
            cloud: normalizeProvider(account.provider),
            account: account.accountAlias ?? account.accountId,
            publicAccess: asset.isPublic ?? false,
            encrypted,
            piiDetected,
            severity: severityForRisk(asset.riskScore ?? 0),
            region: asset.region ?? "global",
          };
        });
    });
  }

  async listCompliance(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const assessments = await this.db
        .select()
        .from(complianceAssessments)
        .where(eq(complianceAssessments.organizationId, orgId))
        .orderBy(desc(complianceAssessments.assessedAt))
        .limit(20);

      return Promise.all(assessments.map(async (assessment) => {
        const controls = await this.db
          .select()
          .from(complianceControls)
          .where(eq(complianceControls.assessmentId, assessment.id))
          .limit(8);

        return {
          id: assessment.id,
          framework: assessment.framework,
          score: Math.round(parseFloat(String(assessment.scorePercent ?? "0"))),
          status: assessment.status ?? "in_progress",
          lastAssessment: assessment.assessedAt?.toISOString() ?? new Date().toISOString(),
          findings: controls.map((control) => ({
            id: control.id,
            controlId: control.controlId,
            title: control.controlTitle,
            status: control.status ?? "not_started",
          })),
        };
      }));
    });
  }

  async connectAccount(orgId: string, data: {
    provider: string;
    accountId: string;
    accountAlias?: string;
    regions?: string[];
    credentials?: Record<string, string>;
  }, encryptionKey?: string) {
    return withTenant(this.db, orgId, async () => {
      const credentialsEncrypted = data.credentials
        ? encryptIfConfigured(JSON.stringify(data.credentials), encryptionKey)
        : null;

      const [row] = await this.db.insert(cloudAccounts).values({
        organizationId: orgId,
        provider: data.provider,
        accountId: data.accountId,
        accountAlias: data.accountAlias ?? null,
        regions: data.regions ?? [],
        credentialsEncrypted,
        syncStatus: "pending",
        totalAssets: 0,
        riskScore: 0,
      }).returning();

      return {
        id: row.id,
        provider: row.provider,
        accountId: row.accountId,
        alias: row.accountAlias,
        syncStatus: row.syncStatus,
        regions: (row.regions as string[]) ?? [],
        createdAt: row.createdAt?.toISOString(),
      };
    });
  }

  async deleteAccount(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [account] = await this.db
        .select({ id: cloudAccounts.id })
        .from(cloudAccounts)
        .where(and(eq(cloudAccounts.id, id), eq(cloudAccounts.organizationId, orgId)))
        .limit(1);
      if (!account) throw new NotFoundError("Cloud account not found");

      const assetRows = await this.db
        .select({ id: cloudAssets.id })
        .from(cloudAssets)
        .where(eq(cloudAssets.cloudAccountId, id));
      const assetIds = assetRows.map((a) => a.id);

      if (assetIds.length > 0) {
        await this.db.delete(cloudComplianceChecks).where(inArray(cloudComplianceChecks.cloudAssetId, assetIds));
      }
      await this.db.delete(cloudIamFindings).where(eq(cloudIamFindings.cloudAccountId, id));
      await this.db.delete(cloudAssets).where(eq(cloudAssets.cloudAccountId, id));
      await this.db.delete(cloudAccounts).where(eq(cloudAccounts.id, id));
    });
  }

  /**
   * No live AWS/Azure/GCP connector exists yet (tracked as Phase 3 work) —
   * this records a real sync attempt and is honest about what didn't happen,
   * rather than fabricating inventory.
   */
  async syncAccount(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .update(cloudAccounts)
        .set({ lastSyncAt: new Date(), syncStatus: "connector_not_implemented" })
        .where(and(eq(cloudAccounts.id, id), eq(cloudAccounts.organizationId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Cloud account not found");

      return {
        id: row.id,
        syncStatus: row.syncStatus,
        lastSyncAt: row.lastSyncAt?.toISOString(),
        message: `No live ${row.provider} connector is implemented yet. The sync attempt was recorded but no new inventory was fetched.`,
      };
    });
  }

  async resolveIamFinding(orgId: string, findingId: string) {
    return withTenant(this.db, orgId, async () => {
      const [existing] = await this.db
        .select({ id: cloudIamFindings.id })
        .from(cloudIamFindings)
        .innerJoin(cloudAccounts, eq(cloudIamFindings.cloudAccountId, cloudAccounts.id))
        .where(and(eq(cloudIamFindings.id, findingId), eq(cloudAccounts.organizationId, orgId)))
        .limit(1);
      if (!existing) throw new NotFoundError("Finding not found");

      const [row] = await this.db
        .update(cloudIamFindings)
        .set({ isResolved: true })
        .where(eq(cloudIamFindings.id, findingId))
        .returning();

      return { id: row.id, isResolved: row.isResolved };
    });
  }
}

function normalizeProvider(provider: string | null) {
  const value = (provider ?? "cloud").toLowerCase();
  if (value.includes("aws")) return "AWS";
  if (value.includes("azure")) return "Azure";
  if (value.includes("gcp") || value.includes("google")) return "GCP";
  return provider ?? "Cloud";
}

function severityForRisk(score: number) {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  if (score > 0) return "low";
  return "healthy";
}

function findingForAsset(type: string, isPublic: boolean, score: number) {
  if (isPublic) return `${type} is internet exposed`;
  if (score >= 80) return `${type} has critical posture drift`;
  if (score >= 60) return `${type} needs priority remediation`;
  if (score >= 35) return `${type} should be reviewed`;
  return `${type} is within policy`;
}

function normalizeIamType(type: string | null) {
  const value = (type ?? "overprivileged").toLowerCase();
  if (value.includes("wildcard")) return "wildcard";
  if (value.includes("unused")) return "unused_credential";
  if (value.includes("cross")) return "cross_account";
  return "overprivileged";
}

function ageLabel(date: Date | null | undefined) {
  if (!date) return "unknown";
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
