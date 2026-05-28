import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotifSeverity = "info" | "medium" | "high" | "critical" | "healthy";

export interface Notif {
  id: string;
  title: string;
  body: string;
  severity: NotifSeverity;
  at: number;
  read: boolean;
  link?: string;
}

const seed: Notif[] = [
  { id: "n-1", title: "Critical: ransomware behavior detected", body: "Endpoint EP-4421 — encrypted 28 files in 90s", severity: "critical", at: Date.now() - 120_000, read: false, link: "/incidents" },
  { id: "n-2", title: "New incident assigned", body: "INC-2087 → you (Acme Production)", severity: "high", at: Date.now() - 900_000, read: false, link: "/incidents" },
  { id: "n-3", title: "Detection rule deployed", body: "T1059.001 PowerShell obfuscation — staged → production", severity: "info", at: Date.now() - 2 * 3_600_000, read: false, link: "/detection-rules" },
  { id: "n-4", title: "Compliance drift", body: "SOC2 CC6.1 — 3 endpoints missing EDR agent", severity: "medium", at: Date.now() - 4 * 3_600_000, read: false, link: "/compliance" },
  { id: "n-5", title: "Workspace switched", body: "Now operating in Acme Production", severity: "info", at: Date.now() - 6 * 3_600_000, read: true },
  { id: "n-6", title: "MFA re-enrollment due", body: "YubiKey 5C expires in 14 days", severity: "high", at: Date.now() - 12 * 3_600_000, read: true, link: "/profile" },
  { id: "n-7", title: "Backup verified", body: "Nightly snapshot — 100% integrity", severity: "healthy", at: Date.now() - 18 * 3_600_000, read: true },
];

interface NotifState {
  items: Notif[];
  push: (n: Omit<Notif, "id" | "at" | "read"> & { at?: number }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useNotifications = create<NotifState>()(
  persist(
    (set) => ({
      items: seed,
      push: (n) =>
        set((s) => ({
          items: [{ id: `n-${crypto.randomUUID().slice(0, 8)}`, at: n.at ?? Date.now(), read: false, ...n }, ...s.items].slice(0, 100),
        })),
      markRead: (id) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, read: true } : x)) })),
      markAllRead: () => set((s) => ({ items: s.items.map((x) => ({ ...x, read: true })) })),
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "nexus.notifications", version: 1 },
  ),
);
