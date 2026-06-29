import { eq, and, desc, ilike, or } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { knowledgeArticles, knowledgeBookmarks } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export class KnowledgeService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string, search?: string, category?: string) {
    return withTenant(this.db, orgId, async () => {
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
    return withTenant(this.db, orgId, async () => {
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

  async create(orgId: string, authorId: string, body: { title: string; category?: string; content: string; tags?: string[]; isPublished?: boolean }) {
    return withTenant(this.db, orgId, async () => {
      const slugBase = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [row] = await this.db.insert(knowledgeArticles).values({
        organizationId: orgId,
        authorId,
        title: body.title,
        slug: `${slugBase}-${Date.now().toString().slice(-5)}`,
        category: body.category ?? "General",
        content: body.content,
        tags: body.tags ?? [],
        isPublished: body.isPublished ?? true,
      }).returning();

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        category: row.category ?? "General",
        content: row.content,
        tags: (row.tags as string[]) ?? [],
        isPublished: row.isPublished,
        updatedAt: row.updatedAt?.toISOString() ?? row.createdAt?.toISOString(),
      };
    });
  }

  async update(orgId: string, id: string, data: {
    title?: string;
    category?: string;
    content?: string;
    tags?: string[];
    isPublished?: boolean;
  }) {
    return withTenant(this.db, orgId, async () => {
      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (data.title !== undefined) updateFields.title = data.title;
      if (data.category !== undefined) updateFields.category = data.category;
      if (data.content !== undefined) updateFields.content = data.content;
      if (data.tags !== undefined) updateFields.tags = data.tags;
      if (data.isPublished !== undefined) updateFields.isPublished = data.isPublished;

      const [row] = await this.db
        .update(knowledgeArticles)
        .set(updateFields)
        .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.organizationId, orgId)))
        .returning();
      if (!row) return null;
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        category: row.category,
        content: row.content,
        tags: (row.tags as string[]) ?? [],
        isPublished: row.isPublished,
        updatedAt: row.updatedAt?.toISOString(),
      };
    });
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    return withTenant(this.db, orgId, async () => {
      const [deleted] = await this.db
        .delete(knowledgeArticles)
        .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.organizationId, orgId)))
        .returning({ id: knowledgeArticles.id });
      return !!deleted;
    });
  }

  async listBookmarks(orgId: string, userId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select({ article: knowledgeArticles, bookmarkedAt: knowledgeBookmarks.createdAt })
        .from(knowledgeBookmarks)
        .innerJoin(knowledgeArticles, eq(knowledgeBookmarks.articleId, knowledgeArticles.id))
        .where(and(eq(knowledgeBookmarks.organizationId, orgId), eq(knowledgeBookmarks.userId, userId)))
        .orderBy(desc(knowledgeBookmarks.createdAt));

      return rows.map(({ article, bookmarkedAt }) => ({
        id: article.id,
        title: article.title,
        slug: article.slug,
        category: article.category ?? "General",
        excerpt: article.content.slice(0, 200),
        bookmarkedAt: bookmarkedAt?.toISOString(),
      }));
    });
  }

  async bookmark(orgId: string, userId: string, articleId: string) {
    return withTenant(this.db, orgId, async () => {
      const [article] = await this.db
        .select({ id: knowledgeArticles.id })
        .from(knowledgeArticles)
        .where(and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.organizationId, orgId)))
        .limit(1);
      if (!article) throw new NotFoundError("Article not found");

      await this.db
        .insert(knowledgeBookmarks)
        .values({ organizationId: orgId, userId, articleId })
        .onConflictDoNothing();
      return { bookmarked: true };
    });
  }

  async unbookmark(orgId: string, userId: string, articleId: string) {
    return withTenant(this.db, orgId, async () => {
      await this.db
        .delete(knowledgeBookmarks)
        .where(and(
          eq(knowledgeBookmarks.organizationId, orgId),
          eq(knowledgeBookmarks.userId, userId),
          eq(knowledgeBookmarks.articleId, articleId),
        ));
      return { bookmarked: false };
    });
  }
}
