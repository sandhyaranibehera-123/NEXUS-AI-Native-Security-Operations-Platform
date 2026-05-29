import { eq, and, desc, lt, gte, ilike, or, sql, count } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { securityEvents } from "@nexus/db/schema";
import type postgres from "postgres";
import type { SecurityEventListQuery } from "@nexus/shared";
import { withTenant } from "../../lib/tenant.js";

export class EventsService {
  constructor(
    private db: DbClient,
    private client: postgres.Sql,
  ) {}

  async list(orgId: string, query: SecurityEventListQuery) {
    return withTenant(this.client, orgId, async () => {
      const conditions = [eq(securityEvents.organizationId, orgId)];

      if (query.severity?.length) {
        conditions.push(sql`${securityEvents.severity} = ANY(${query.severity})`);
      }
      if (query.type?.length) {
        conditions.push(sql`${securityEvents.type} = ANY(${query.type})`);
      }
      if (query.from) {
        conditions.push(gte(securityEvents.eventTimestamp, new Date(query.from)));
      }
      if (query.to) {
        conditions.push(lt(securityEvents.eventTimestamp, new Date(query.to)));
      }
      if (query.since) {
        conditions.push(gte(securityEvents.eventTimestamp, new Date(query.since)));
      }
      if (query.search) {
        const term = `%${query.search}%`;
        conditions.push(or(
          ilike(securityEvents.message, term),
          ilike(securityEvents.username, term),
          ilike(securityEvents.host, term),
          ilike(securityEvents.sourceIp, term),
        )!);
      }
      if (query.cursor) {
        conditions.push(lt(securityEvents.id, query.cursor));
      }

      const rows = await this.db
        .select()
        .from(securityEvents)
        .where(and(...conditions))
        .orderBy(desc(securityEvents.eventTimestamp))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      const items = hasMore ? rows.slice(0, query.limit) : rows;

      return {
        items: items.map(mapEvent),
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.client, orgId, async () => {
      const [row] = await this.db
        .select()
        .from(securityEvents)
        .where(and(eq(securityEvents.id, id), eq(securityEvents.organizationId, orgId)))
        .limit(1);
      return row ? mapEvent(row) : null;
    });
  }

  async countLast24h(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [result] = await this.db
        .select({ count: count() })
        .from(securityEvents)
        .where(and(
          eq(securityEvents.organizationId, orgId),
          gte(securityEvents.eventTimestamp, since),
        ));
      return result?.count ?? 0;
    });
  }
}

function mapEvent(row: typeof securityEvents.$inferSelect) {
  return {
    id: row.id,
    timestamp: row.eventTimestamp.toISOString(),
    type: row.type,
    severity: row.severity,
    source: row.source,
    sourceIp: row.sourceIp,
    destIp: row.destIp,
    user: row.username,
    host: row.host,
    rule: row.ruleName,
    message: row.message,
    country: row.countryCode,
    asset: row.asset,
    mitre: row.mitreTechnique,
    raw: (row.rawData as Record<string, unknown>) ?? {},
  };
}

export { mapEvent };
