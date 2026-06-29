import { eq, and } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { complianceAssessments, complianceControls } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class ComplianceService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async listAssessments(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const assessments = await this.db
        .select()
        .from(complianceAssessments)
        .where(eq(complianceAssessments.organizationId, orgId));

      return Promise.all(assessments.map(async (a) => {
        const controls = await this.db
          .select()
          .from(complianceControls)
          .where(eq(complianceControls.assessmentId, a.id));

        return {
          id: a.id,
          framework: a.framework,
          name: a.name,
          totalControls: a.totalControls,
          passedControls: a.passedControls,
          scorePercent: Number(a.scorePercent ?? 0),
          status: a.status,
          assessedAt: a.assessedAt?.toISOString(),
          controls: controls.map((c) => ({
            id: c.id,
            controlId: c.controlId,
            title: c.controlTitle,
            status: c.status,
            description: c.description,
          })),
        };
      }));
    });
  }
}
