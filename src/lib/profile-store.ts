import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Session {
  id: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: number;
  current?: boolean;
}

export interface Device {
  id: string;
  name: string;
  os: string;
  lastSeen: number;
  status: "trusted" | "managed" | "unknown";
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scope: "read" | "write" | "admin";
  createdAt: number;
  lastUsed: number;
}

export interface OAuthProvider {
  id: string;
  name: string;
  account: string;
  connected: boolean;
}

export interface TimelineEvent {
  id: string;
  action: string;
  detail: string;
  at: number;
  tone: "info" | "healthy" | "medium" | "high" | "critical";
}

const now = Date.now();

const seedSessions: Session[] = [
  { id: "s-1", browser: "Chrome 124", ip: "10.4.22.18", location: "New York, US", lastActive: now, current: true },
  { id: "s-2", browser: "Firefox 126", ip: "203.0.113.42", location: "Singapore, SG", lastActive: now - 7_200_000 },
  { id: "s-3", browser: "Safari 17", ip: "192.0.2.55", location: "Mumbai, IN", lastActive: now - 86_400_000 },
  { id: "s-4", browser: "Edge 124", ip: "198.51.100.7", location: "London, UK", lastActive: now - 3 * 86_400_000 },
];

const seedDevices: Device[] = [
  { id: "d-1", name: 'MacBook Pro 16"', os: "macOS 14.5", lastSeen: now, status: "trusted" },
  { id: "d-2", name: "ThinkPad X1 Carbon", os: "Windows 11", lastSeen: now - 7_200_000, status: "trusted" },
  { id: "d-3", name: "iPhone 15 Pro", os: "iOS 17.5", lastSeen: now - 86_400_000, status: "managed" },
  { id: "d-4", name: "Pixel 8", os: "Android 14", lastSeen: now - 14 * 86_400_000, status: "unknown" },
];

const seedTokens: ApiToken[] = [
  { id: "t-1", name: "terraform-provider", prefix: "nxs_a8f2…", scope: "admin", createdAt: now - 90 * 86_400_000, lastUsed: now - 3_600_000 },
  { id: "t-2", name: "ci-pipeline-deploy", prefix: "nxs_3c91…", scope: "write", createdAt: now - 30 * 86_400_000, lastUsed: now - 6 * 3_600_000 },
  { id: "t-3", name: "grafana-datasource", prefix: "nxs_e7d4…", scope: "read", createdAt: now - 15 * 86_400_000, lastUsed: now - 2 * 86_400_000 },
];

const seedProviders: OAuthProvider[] = [
  { id: "p-google", name: "Google", account: "k.morgan@acme.io", connected: true },
  { id: "p-github", name: "GitHub", account: "kmorgan", connected: true },
  { id: "p-okta", name: "Okta", account: "k.morgan@acme.io", connected: true },
  { id: "p-slack", name: "Slack", account: "—", connected: false },
];

const seedTimeline: TimelineEvent[] = [
  { id: "ev-1", action: "Logged in from new device", detail: "MacBook Pro — New York, US", at: now - 120_000, tone: "info" },
  { id: "ev-2", action: "Role changed to Security Admin", detail: "by root@acme.io", at: now - 3 * 3_600_000, tone: "high" },
  { id: "ev-3", action: "API token rotated", detail: "ci-pipeline-deploy", at: now - 6 * 3_600_000, tone: "medium" },
  { id: "ev-4", action: "MFA enrollment completed", detail: "WebAuthn — YubiKey 5C", at: now - 86_400_000, tone: "healthy" },
];

interface ProfileState {
  sessions: Session[];
  devices: Device[];
  tokens: ApiToken[];
  providers: OAuthProvider[];
  timeline: TimelineEvent[];

  revokeSession: (id: string) => void;
  revokeAllOtherSessions: () => void;
  removeDevice: (id: string) => void;
  trustDevice: (id: string) => void;

  createToken: (name: string, scope: ApiToken["scope"]) => ApiToken;
  revokeToken: (id: string) => void;
  rotateToken: (id: string) => void;

  toggleProvider: (id: string) => void;
  logActivity: (e: Omit<TimelineEvent, "id" | "at"> & { at?: number }) => void;
  clearTimeline: () => void;
}

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      sessions: seedSessions,
      devices: seedDevices,
      tokens: seedTokens,
      providers: seedProviders,
      timeline: seedTimeline,

      revokeSession: (id) => {
        const target = get().sessions.find((s) => s.id === id);
        set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
        if (target) get().logActivity({ action: "Session revoked", detail: `${target.browser} — ${target.location}`, tone: "critical" });
      },
      revokeAllOtherSessions: () => {
        set((s) => ({ sessions: s.sessions.filter((x) => x.current) }));
        get().logActivity({ action: "Revoked all other sessions", detail: "Bulk action", tone: "high" });
      },
      removeDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
      trustDevice: (id) => set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, status: "trusted" } : d)) })),

      createToken: (name, scope) => {
        const tok: ApiToken = {
          id: `t-${crypto.randomUUID().slice(0, 8)}`,
          name,
          scope,
          prefix: `nxs_${crypto.randomUUID().slice(0, 4)}…`,
          createdAt: Date.now(),
          lastUsed: 0,
        };
        set((s) => ({ tokens: [tok, ...s.tokens] }));
        get().logActivity({ action: "API token created", detail: `${name} (${scope})`, tone: "info" });
        return tok;
      },
      revokeToken: (id) => {
        const t = get().tokens.find((x) => x.id === id);
        set((s) => ({ tokens: s.tokens.filter((x) => x.id !== id) }));
        if (t) get().logActivity({ action: "API token revoked", detail: t.name, tone: "high" });
      },
      rotateToken: (id) =>
        set((s) => ({
          tokens: s.tokens.map((t) =>
            t.id === id ? { ...t, prefix: `nxs_${crypto.randomUUID().slice(0, 4)}…`, createdAt: Date.now() } : t,
          ),
        })),

      toggleProvider: (id) => set((s) => ({ providers: s.providers.map((p) => (p.id === id ? { ...p, connected: !p.connected } : p)) })),
      logActivity: (e) =>
        set((s) => ({
          timeline: [{ id: `ev-${crypto.randomUUID().slice(0, 8)}`, at: e.at ?? Date.now(), ...e }, ...s.timeline].slice(0, 40),
        })),
      clearTimeline: () => set({ timeline: [] }),
    }),
    { name: "nexus.profile", version: 1 },
  ),
);

export function timeAgo(ts: number) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
