import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema.js";

export type DbClient = PostgresJsDatabase<typeof schema>;

const transactionContext = new AsyncLocalStorage<DbClient>();

function transactionAwareDb(baseDb: DbClient): DbClient {
  return new Proxy(baseDb, {
    get(target, property) {
      const activeDb = transactionContext.getStore() ?? target;
      const value = Reflect.get(activeDb, property, activeDb) as unknown;
      return typeof value === "function" ? value.bind(activeDb) : value;
    },
  });
}

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 20, idle_timeout: 20 });
  const db = transactionAwareDb(drizzle(client, { schema }));
  return { db, client };
}

/**
 * Session-scoped tenant context — use ONLY within a single reserved connection,
 * never on a pooled client. Prefer withTenantTxn for normal service calls.
 */
export async function setTenantContext(client: postgres.Sql, orgId: string) {
  await client`SELECT set_config('app.current_org', ${orgId}, true)`;
}

/**
 * Transaction-scoped tenant pinning (P0 security fix).
 * Uses Drizzle's db.transaction() so we never call drizzle() on a
 * TransactionSql object (which lacks .options.parsers and would crash).
 * SET LOCAL pins the tenant config to the transaction; it cannot bleed
 * to other pooled connections once the transaction commits or rolls back.
 */
export async function withTenantTxn<T>(
  db: DbClient,
  orgId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org', ${orgId}, true)`,
    );
    return transactionContext.run(tx as DbClient, fn);
  });
}

export { schema };
