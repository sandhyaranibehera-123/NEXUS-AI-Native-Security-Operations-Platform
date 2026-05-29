import { eq, and, desc, ilike, or } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { knowledgeArticles } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export class KnowledgeService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, search?: string, category?: string) {
    return withTenant(this.client, orgId, async () => {
      const conditions = [eq(knowledgeArticles.organizationId, orgId)];
      if (search) {
        conditions.push(or(
          ilike(knowledgeArticles.title, `%${search}%`),
          ilike(knowledgeArticles.content, `%${search}%`),
        )!);
      }
      if (category) conditions.push(eq(knowledgeArticles.category, category));

      const rows = await this.db
        .select()
        .from(knowledgeArticles)
        .where(and(...conditions))
        .orderBy(desc(knowledgeArticles.updatedAt))
        .limit(100);

      return rows.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        categoryId: (a.category ?? "general").toLowerCase().replace(/\s+/g, "-"),
        category: a.category ?? "General",
        updatedAt: a.updatedAt?.toISOString() ?? a.createdAt?.toISOString() ?? "",
        author: "SOC Team",
        tags: (a.tags as string[]) ?? [],
        excerpt: a.content.slice(0, 200),
        isPublished: a.isPublished,
      }));
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.client, orgId, async () => {
      const [row] = await this.db
        .select()
        .from(knowledgeArticles)
        .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.organizationId, orgId)))
        .limit(1);
      if (!row) throw new NotFoundError("Article not found");
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        category: row.category,
        content: row.content,
        tags: (row.tags as string[]) ?? [],
        updatedAt: row.updatedAt?.toISOString(),
      };
    });
  }
}
