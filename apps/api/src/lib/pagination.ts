export { withTenant } from "./tenant.js";

export function encodeCursor(id: string): string {
  return id;
}

export function decodeCursor(cursor?: string): string | undefined {
  return cursor;
}
