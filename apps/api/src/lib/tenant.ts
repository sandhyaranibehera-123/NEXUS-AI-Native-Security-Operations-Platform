import type postgres from "postgres";
import { setTenantContext } from "@nexus/db";

export async function withTenant<T>(
  client: postgres.Sql,
  orgId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await setTenantContext(client, orgId);
  return fn();
}
