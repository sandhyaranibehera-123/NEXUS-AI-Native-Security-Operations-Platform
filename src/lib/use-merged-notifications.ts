import { useMemo } from "react";
import { useApiNotifications, useMarkNotificationRead } from "./api-hooks";
import { useNotifications, type Notif } from "./notifications-store";
import { useAuth } from "./auth-store";

/** API notifications when logged in, with localStorage mock fallback. */
export function useMergedNotifications() {
  const user = useAuth((s) => s.user);
  const localItems = useNotifications((s) => s.items);
  const localMarkRead = useNotifications((s) => s.markRead);
  const localMarkAllRead = useNotifications((s) => s.markAllRead);
  const localRemove = useNotifications((s) => s.remove);
  const localClear = useNotifications((s) => s.clear);

  const apiQuery = useApiNotifications();
  const apiMarkRead = useMarkNotificationRead();

  const items: Notif[] = useMemo(() => {
    if (user && apiQuery.data?.items?.length) {
      return apiQuery.data.items.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body ?? "",
        severity: mapSeverity(n.severity),
        at: new Date(n.createdAt).getTime(),
        read: n.isRead,
      }));
    }
    return localItems;
  }, [user, apiQuery.data, localItems]);

  const isLive = !!(user && apiQuery.data?.items?.length && !apiQuery.isError);

  return {
    items,
    isLive,
    unread: items.filter((n) => !n.read).length,
    markRead: (id: string) => {
      if (isLive) apiMarkRead.mutate(id);
      else localMarkRead(id);
    },
    markAllRead: () => {
      if (!isLive) localMarkAllRead();
      else items.filter((n) => !n.read).forEach((n) => apiMarkRead.mutate(n.id));
    },
    remove: localRemove,
    clear: localClear,
  };
}

function mapSeverity(s: string): Notif["severity"] {
  if (s === "critical" || s === "high" || s === "medium" || s === "info" || s === "healthy") return s;
  return "info";
}
