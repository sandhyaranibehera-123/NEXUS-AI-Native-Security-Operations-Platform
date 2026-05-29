import { eq, and, desc, ilike, sql } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { vulnerabilities, assetVulnerabilities } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class VulnerabilitiesService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, search?: string, limit = 50) {
    return withTenant(this.client, orgId, async () => {
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
