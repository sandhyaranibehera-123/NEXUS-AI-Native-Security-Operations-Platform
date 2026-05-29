import { eq } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { organizations } from "@nexus/db/schema";
import { NotFoundError } from "../../lib/errors.js";

export class OrganizationsService {
  constructor(private db: DbClient) {}

  async getById(orgId: string) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) throw new NotFoundError("Organization not found");

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      industry: org.industry,
      settings: org.settings,
    };
  }
}
