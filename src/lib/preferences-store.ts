import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  slack: boolean;
  webhook: boolean;
  digest: "off" | "daily" | "weekly";
  minSeverity: "info" | "medium" | "high" | "critical";
}

export interface SecurityPrefs {
  mfa: boolean;
  sessionTimeoutMin: number;
  ipAllowlistEnabled: boolean;
  ipAllowlist: string[];
  passwordRotationDays: number;
}

export interface UiPrefs {
  density: "comfortable" | "compact";
  dateFormat: "iso" | "us" | "eu";
  timezone: string;
  defaultLanding: "/dashboard" | "/executive" | "/incidents";
  showHeatmap: boolean;
}

interface PrefsState {
  notifications: NotificationPrefs;
  security: SecurityPrefs;
  ui: UiPrefs;
  setNotifications: (p: Partial<NotificationPrefs>) => void;
  setSecurity: (p: Partial<SecurityPrefs>) => void;
  setUi: (p: Partial<UiPrefs>) => void;
  reset: () => void;
}

const DEFAULTS = {
  notifications: { email: true, push: true, slack: false, webhook: true, digest: "daily" as const, minSeverity: "high" as const },
  security: {
    mfa: true,
    sessionTimeoutMin: 30,
    ipAllowlistEnabled: true,
    ipAllowlist: ["10.0.0.0/8", "192.168.1.0/24", "203.0.113.0/24"],
    passwordRotationDays: 90,
  },
  ui: { density: "comfortable" as const, dateFormat: "iso" as const, timezone: "UTC", defaultLanding: "/dashboard" as const, showHeatmap: true },
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setNotifications: (p) => set((s) => ({ notifications: { ...s.notifications, ...p } })),
      setSecurity: (p) => set((s) => ({ security: { ...s.security, ...p } })),
      setUi: (p) => set((s) => ({ ui: { ...s.ui, ...p } })),
      reset: () => set(DEFAULTS),
    }),
    { name: "nexus.preferences", version: 1 },
  ),
);
