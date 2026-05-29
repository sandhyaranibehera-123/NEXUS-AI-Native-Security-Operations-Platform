import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type DbClient = ReturnType<typeof createDb>["db"];

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 20, idle_timeout: 20 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function setTenantContext(client: postgres.Sql, orgId: string) {
  await client`SELECT set_config('app.current_org', ${orgId}, false)`;
}

export { schema };
