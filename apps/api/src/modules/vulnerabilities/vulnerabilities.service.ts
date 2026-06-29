import { eq, and, desc, ilike, sql } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { vulnerabilities, assetVulnerabilities, auditLogs } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export class VulnerabilitiesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async getById(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [vuln] = await this.db
        .select()
        .from(vulnerabilities)
        .where(eq(vulnerabilities.id, id))
        .limit(1);
      if (!vuln) return null;

      const assetLinks = await this.db
        .select()
        .from(assetVulnerabilities)
        .where(and(eq(assetVulnerabilities.vulnerabilityId, id), eq(assetVulnerabilities.organizationId, orgId)));

      return {
        id: vuln.id,
        cve: vuln.cveId,
        title: vuln.title,
        description: vuln.description ?? "",
        cvss: Number(vuln.cvssScore ?? 0),
        cvssVector: vuln.cvssVector,
        epss: Number(vuln.epssScore ?? 0),
        epssPercentile: Number(vuln.epssPercentile ?? 0),
        severity: vuln.severity,
        patchStatus: vuln.patchStatus ?? "unpatched",
        exploitStatus: vuln.exploitStatus ?? "none",
        affectedPackages: (vuln.affectedPackages as string[]) ?? [],
        referenceLinks: (vuln.referenceLinks as string[]) ?? [],
        cweIds: (vuln.cweIds as string[]) ?? [],
        publishedAt: vuln.publishedAt?.toISOString() ?? null,
        affectedAssets: assetLinks.map((a) => ({
          id: a.id,
          assetId: a.assetId,
          assetType: a.assetType,
          status: a.status,
          riskAccepted: a.riskAccepted ?? false,
          riskAcceptedAt: a.riskAcceptedAt?.toISOString() ?? null,
          patchedAt: a.patchedAt?.toISOString() ?? null,
          discoveredAt: a.discoveredAt?.toISOString() ?? null,
        })),
      };
    });
  }

  async createException(
    orgId: string,
    vulnerabilityId: string,
    data: { assetId?: string; reason?: string },
    actor: { id: string; email: string },
  ) {
    return withTenant(this.db, orgId, async () => {
      const conditions = [
        eq(assetVulnerabilities.vulnerabilityId, vulnerabilityId),
        eq(assetVulnerabilities.organizationId, orgId),
      ];
      if (data.assetId) conditions.push(eq(assetVulnerabilities.assetId, data.assetId));

      const rows = await this.db
        .update(assetVulnerabilities)
        .set({
          riskAccepted: true,
          riskAcceptedBy: actor.id,
          riskAcceptedAt: new Date(),
          status: "risk_accepted",
        })
        .where(and(...conditions))
        .returning();
      if (rows.length === 0) throw new NotFoundError("No matching asset vulnerability found");

      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId: actor.id,
        userEmail: actor.email,
        action: "vulnerability.exception_granted",
        resourceType: "vulnerability",
        resourceId: vulnerabilityId,
        metadata: { reason: data.reason ?? null, assetCount: rows.length },
      });

      return {
        vulnerabilityId,
        exceptedAssetCount: rows.length,
        reason: data.reason ?? null,
      };
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    data: { patchStatus?: string },
    actor: { id: string; email: string },
  ) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .update(vulnerabilities)
        .set({ patchStatus: data.patchStatus })
        .where(eq(vulnerabilities.id, id))
        .returning();
      if (!row) return null;

      await this.db.insert(auditLogs).values({
        organizationId: orgId,
        userId: actor.id,
        userEmail: actor.email,
        action: data.patchStatus === "patched"
          ? "vulnerability.mark_patched"
          : data.patchStatus === "dismissed"
            ? "vulnerability.dismiss"
            : "vulnerability.status_change",
        resourceType: "vulnerability",
        resourceId: row.id,
      });

      return {
        id: row.id,
        cve: row.cveId,
        patchStatus: row.patchStatus,
        severity: row.severity,
      };
    });
  }

  async list(orgId: string, search?: string, limit = 50) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({
          vuln: vulnerabilities,
          assetCount: sql<number>`count(${assetVulnerabilities.id})::int`,
        })
        .from(vulnerabilities)
        .leftJoin(
          assetVulnerabilities,
          and(
            eq(assetVulnerabilities.vulnerabilityId, vulnerabilities.id),
            eq(assetVulnerabilities.organizationId, orgId),
          ),
        )
        .where(search ? ilike(vulnerabilities.cveId, `%${search}%`) : undefined)
        .groupBy(vulnerabilities.id)
        .orderBy(desc(vulnerabilities.cvssScore))
        .limit(limit);

      return rows.map(({ vuln, assetCount }) => ({
        id: vuln.id,
        cve: vuln.cveId,
        cvss: Number(vuln.cvssScore ?? 0),
        epss: Number(vuln.epssScore ?? 0),
        affectedPackages: (vuln.affectedPackages as string[]) ?? [],
        assetCount: assetCount ?? 0,
        patchStatus: vuln.patchStatus ?? "unpatched",
        exploitStatus: vuln.exploitStatus ?? "none",
        severity: vuln.severity,
        publishedAt: vuln.publishedAt?.toISOString() ?? "",
        description: vuln.description ?? "",
      }));
    });
  }
}
