import type { DbClient } from "@nexus/db";
import { withTenantTxn } from "@nexus/db";

/**
 * Runs service callbacks with a transaction-pinned tenant context. The
 * transaction-aware DbClient from createDb routes existing `this.db` calls to
 * the active transaction, preserving RLS without changing every service.
 */
export async function withTenant<T>(
  db: DbClient,
  orgId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withTenantTxn(db, orgId, fn);
}

/**
 * Runs fn inside a single transaction with tenant context pinned via SET LOCAL.
 * Alias of withTenant — kept for call-site clarity where transactional intent
 * is explicit. The fn no longer receives a raw TransactionSql; use app.db
 * (the transaction-aware proxy) inside fn instead.
 */
export async function withTenantTx<T>(
  db: DbClient,
  orgId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withTenantTxn(db, orgId, fn);
}
