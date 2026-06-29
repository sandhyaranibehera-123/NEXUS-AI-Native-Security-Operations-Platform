import { eq, and, ilike, or } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { knowledgeArticles, incidents } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class RagService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
  ) {}

  async retrieveContext(orgId: string, query: string, limit = 5): Promise<string> {
    return withTenant(this.db, orgId, async () => {
      const term = `%${query.slice(0, 100)}%`;
      const articles = await this.db
        .select({ title: knowledgeArticles.title, content: knowledgeArticles.content })
        .from(knowledgeArticles)
        .where(and(
          eq(knowledgeArticles.organizationId, orgId),
          eq(knowledgeArticles.isPublished, true),
          or(ilike(knowledgeArticles.title, term), ilike(knowledgeArticles.content, term)),
        ))
        .limit(limit);

      const incidentMatches = await this.db
        .select({ code: incidents.incidentCode, title: incidents.title, summary: incidents.summary })
        .from(incidents)
        .where(and(
          eq(incidents.organizationId, orgId),
          or(ilike(incidents.title, term), ilike(incidents.incidentCode, term)),
        ))
        .limit(3);

      const parts: string[] = [];
      for (const a of articles) {
        parts.push(`[KB] ${a.title}: ${a.content.slice(0, 500)}`);
      }
      for (const i of incidentMatches) {
        parts.push(`[${i.code}] ${i.title}: ${i.summary ?? "No summary"}`);
      }
      return parts.join("\n\n");
    });
  }
}
