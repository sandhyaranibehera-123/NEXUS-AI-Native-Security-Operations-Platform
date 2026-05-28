import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User, Shield, Key, Monitor, Smartphone, Globe, Bell, Clock, Building2, Lock,
  Trash2, ExternalLink, Activity, Webhook, Mail, MessageSquare,
  CircleCheck as CheckCircle2, Circle as XCircle, Plus, RefreshCw, ArrowRight, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { useAccounts } from "@/lib/accounts-store";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { useProfile, timeAgo } from "@/lib/profile-store";
import { usePrefs } from "@/lib/preferences-store";
import { ROLE_LABEL, ROLE_PERMISSIONS, type Permission } from "@/lib/rbac";
import { ROLE_RANK } from "@/lib/role-hierarchy";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { WorkspaceContext } from "@/components/workspace-context";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — NEXUS" }] }),
  component: ProfilePage,
});

function SectionHeader({ icon: Icon, children, action }: { icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{children}</h3>
      </div>
      {action}
    </div>
  );
}

function ProfilePage() {
  const { user, logout } = useAuth();
  const accounts = useAccounts((s) => s.accounts);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const sessions = useProfile((s) => s.sessions);
  const devices = useProfile((s) => s.devices);
  const tokens = useProfile((s) => s.tokens);
  const providers = useProfile((s) => s.providers);
  const timeline = useProfile((s) => s.timeline);
  const revokeSession = useProfile((s) => s.revokeSession);
  const revokeAllOtherSessions = useProfile((s) => s.revokeAllOtherSessions);
  const removeDevice = useProfile((s) => s.removeDevice);
  const trustDevice = useProfile((s) => s.trustDevice);
  const createToken = useProfile((s) => s.createToken);
  const revokeToken = useProfile((s) => s.revokeToken);
  const rotateToken = useProfile((s) => s.rotateToken);
  const toggleProvider = useProfile((s) => s.toggleProvider);
  const clearTimeline = useProfile((s) => s.clearTimeline);

  const notif = usePrefs((s) => s.notifications);
  const setNotifications = usePrefs((s) => s.setNotifications);

  const [showNewToken, setShowNewToken] = useState(false);

  if (!user) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground font-mono text-sm">No active session</div>;
  }

  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const permissions = ROLE_PERMISSIONS[user.role];

  // org memberships derived from accounts/workspaces
  const myWorkspaces = workspaces.map((w) => ({
    name: w.name,
    orgName: w.orgName,
    env: w.environment,
    role: w.role,
    status: w.id === useWorkspaceStore.getState().activeWorkspaceId ? "active" : "ready",
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <WorkspaceContext />

      {/* top bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Account</p>
          <h1 className="text-xl font-semibold text-foreground">Profile &amp; Security</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">{user.id.slice(0, 8)}</Badge>
          <Link
            to="/organizations"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs font-mono hover:bg-surface"
          >
            <Building2 className="size-3.5" /> Organization <ArrowRight className="size-3 opacity-60" />
          </Link>
          <button
            onClick={() => { logout(); toast.success("Signed out"); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-critical/30 bg-critical/10 text-critical px-3 py-1.5 text-xs font-mono hover:bg-critical/20"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile card */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xl font-mono">
                {initials}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h2 className="text-lg font-semibold text-foreground truncate">{user.name}</h2>
                <p className="text-sm text-muted-foreground font-mono truncate">{user.email}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge className="bg-primary/15 text-primary border-primary/30">{ROLE_LABEL[user.role]}</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                    <Shield className="mr-1 h-3 w-3" /> rank {ROLE_RANK[user.role]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                    {permissions.length} permissions
                  </Badge>
                </div>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Workspace</p>
                <p className="text-sm font-medium text-foreground">{user.workspace}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{accounts.length} members</p>
              </div>
            </div>
          </div>

          {/* Workspaces */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Building2} action={
              <Link to="/organizations" className="text-[10px] font-mono text-primary hover:underline">Manage →</Link>
            }>Workspace Memberships</SectionHeader>
            <div className="space-y-2">
              {myWorkspaces.map((org) => (
                <div key={org.name} className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{org.orgName} · {org.role} · {org.env}</p>
                  </div>
                  <Badge className={cn("text-[10px] font-mono",
                    org.status === "active" ? "bg-healthy/15 text-healthy border-healthy/30" : "bg-muted/30 text-muted-foreground border-border")}>
                    {org.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Key} action={
              <Link to="/access-matrix" className="text-[10px] font-mono text-primary hover:underline">Full matrix →</Link>
            }>RBAC Permissions</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                "view:dashboard","view:executive","view:events","view:incidents","act:incidents",
                "view:compliance","view:audit","manage:integrations","manage:org","manage:settings",
                "view:detection-rules","view:hunt",
              ] as Permission[]).map((perm) => {
                const granted = permissions.includes(perm);
                return (
                  <div key={perm} className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-mono",
                    granted ? "border-healthy/30 bg-healthy/5 text-healthy"
                            : "border-border bg-surface-2/30 text-muted-foreground line-through opacity-50",
                  )}>
                    {granted ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                    {perm}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sessions */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Globe} action={
              <button onClick={() => { revokeAllOtherSessions(); toast.success("Revoked other sessions"); }}
                className="text-[10px] font-mono text-critical hover:underline">Revoke all others</button>
            }>Active Sessions ({sessions.length})</SectionHeader>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{s.browser}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.ip} · {s.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-muted-foreground">{timeAgo(s.lastActive)}</span>
                    {s.current ? (
                      <Badge className="bg-healthy/15 text-healthy border-healthy/30 text-[10px]">Current</Badge>
                    ) : (
                      <button onClick={() => { revokeSession(s.id); toast.success("Session revoked"); }}
                        className="text-xs text-critical hover:text-critical/80 font-mono flex items-center gap-1 transition-colors">
                        <Trash2 className="h-3 w-3" /> Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sessions.length === 0 && <p className="text-center text-xs text-muted-foreground font-mono py-4">No active sessions.</p>}
            </div>
          </div>

          {/* Devices */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Smartphone}>Device History ({devices.length})</SectionHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-4">Device</th>
                    <th className="text-left py-2 pr-4">OS</th>
                    <th className="text-left py-2 pr-4">Last seen</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 text-foreground">{d.name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{d.os}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{timeAgo(d.lastSeen)}</td>
                      <td className="py-2.5 pr-4">
                        <Badge className={cn("text-[10px]",
                          d.status === "trusted" ? "bg-healthy/15 text-healthy border-healthy/30"
                          : d.status === "managed" ? "bg-info/15 text-info border-info/30"
                          : "bg-high/15 text-high border-high/30")}>{d.status}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {d.status !== "trusted" && (
                            <button onClick={() => { trustDevice(d.id); toast.success("Device trusted"); }}
                              className="text-[10px] text-healthy hover:underline">Trust</button>
                          )}
                          <button onClick={() => { removeDevice(d.id); toast.success("Device removed"); }}
                            className="text-[10px] text-critical hover:underline ml-2">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Bell}>Notification Preferences</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "email", label: "Email alerts", desc: "Critical & high severity", icon: Mail },
                { key: "push", label: "Push notifications", desc: "Mobile & desktop", icon: Bell },
                { key: "slack", label: "Slack integration", desc: "#security-alerts", icon: MessageSquare },
                { key: "webhook", label: "Webhook", desc: "Custom endpoint", icon: Webhook },
              ].map((n) => (
                <div key={n.key} className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <n.icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground">{n.label}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{n.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={(notif as any)[n.key]}
                    onCheckedChange={(v) => { setNotifications({ [n.key]: v } as any); toast.success("Saved"); }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* API tokens */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Key} action={
              <button onClick={() => setShowNewToken(true)}
                className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:underline">
                <Plus className="size-3" /> New token
              </button>
            }>API Tokens ({tokens.length})</SectionHeader>
            <div className="space-y-2">
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground font-mono truncate">{t.name}</p>
                      <Badge variant="outline" className="text-[9px] font-mono uppercase">{t.scope}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {t.prefix} · created {timeAgo(t.createdAt)} · last used {t.lastUsed ? timeAgo(t.lastUsed) : "never"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { rotateToken(t.id); toast.success("Token rotated"); }}
                      className="text-xs text-muted-foreground hover:text-foreground font-mono flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" /> Rotate
                    </button>
                    <button onClick={() => { revokeToken(t.id); toast.success("Token revoked"); }}
                      className="text-xs text-critical hover:text-critical/80 font-mono flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Revoke
                    </button>
                  </div>
                </div>
              ))}
              {tokens.length === 0 && <p className="text-center text-xs text-muted-foreground font-mono py-4">No API tokens.</p>}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Security shortcut */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Shield} action={
              <Link to="/settings" className="text-[10px] font-mono text-primary hover:underline">Configure →</Link>
            }>Security Snapshot</SectionHeader>
            <SecuritySnapshot />
          </div>

          {/* OAuth providers */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Lock}>Connected Providers</SectionHeader>
            <div className="space-y-2">
              {providers.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{p.account}</p>
                    </div>
                  </div>
                  <button onClick={() => { toggleProvider(p.id); toast.success(p.connected ? "Disconnected" : "Connected"); }}
                    className={cn("text-[10px] font-mono px-2 py-1 rounded border",
                      p.connected ? "border-healthy/30 bg-healthy/10 text-healthy hover:bg-healthy/20"
                                  : "border-border bg-surface text-muted-foreground hover:text-foreground")}>
                    {p.connected ? "Connected" : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Clock} action={
              <button onClick={() => { clearTimeline(); toast.success("Timeline cleared"); }}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground">Clear</button>
            }>Activity Timeline</SectionHeader>
            <div className="space-y-0 max-h-96 overflow-y-auto pr-1">
              {timeline.length === 0 && <p className="text-center text-xs text-muted-foreground font-mono py-4">No activity.</p>}
              {timeline.map((ev, i) => (
                <div key={ev.id} className="relative pl-5 pb-4 last:pb-0">
                  {i < timeline.length - 1 && <div className="absolute left-[5px] top-2 bottom-0 w-px bg-border" />}
                  <div className={cn(
                    "absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-surface",
                    ev.tone === "healthy" ? "bg-healthy"
                    : ev.tone === "critical" ? "bg-critical"
                    : ev.tone === "high" ? "bg-high"
                    : ev.tone === "medium" ? "bg-medium" : "bg-info",
                  )} />
                  <p className="text-xs text-foreground">{ev.action}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{ev.detail} · {timeAgo(ev.at)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Audit */}
          <div className="rounded-lg border border-border bg-surface/60 p-5">
            <SectionHeader icon={Activity}>Audit Summary (7d)</SectionHeader>
            <div className="space-y-2">
              {[
                { label: "Total actions", value: timeline.length + 130 },
                { label: "Sessions opened", value: sessions.length + 34 },
                { label: "Tokens active", value: tokens.length },
                { label: "Failed attempts", value: 3 },
              ].map((a) => (
                <div key={a.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground">{a.label}</span>
                  <span className="text-xs font-mono text-foreground tabular-nums">{a.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showNewToken && (
        <NewTokenDialog onClose={() => setShowNewToken(false)} onCreate={(name, scope) => {
          const t = createToken(name, scope);
          toast.success(`Token ${t.prefix} created — copy it now`);
        }} />
      )}
    </div>
  );
}

function SecuritySnapshot() {
  const s = usePrefs((x) => x.security);
  const set = usePrefs((x) => x.setSecurity);
  return (
    <div className="space-y-3">
      <Row label="Multi-Factor Auth" hint="WebAuthn + TOTP">
        <Switch checked={s.mfa} onCheckedChange={(v) => { set({ mfa: v }); toast.success("Saved"); }} />
      </Row>
      <Row label="Session Timeout" hint={`${s.sessionTimeoutMin} min`}>
        <select value={s.sessionTimeoutMin} onChange={(e) => set({ sessionTimeoutMin: +e.target.value })}
          className="rounded border border-border bg-background px-2 py-1 text-[11px] font-mono">
          {[15, 30, 60, 120, 240].map((m) => <option key={m} value={m}>{m}m</option>)}
        </select>
      </Row>
      <Row label="IP Allow-List" hint={`${s.ipAllowlist.length} ranges`}>
        <Switch checked={s.ipAllowlistEnabled} onCheckedChange={(v) => set({ ipAllowlistEnabled: v })} />
      </Row>
      <Row label="Password Rotation" hint={`${s.passwordRotationDays} days`}>
        <Badge variant="outline" className="text-[10px] font-mono">Enforced</Badge>
      </Row>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function NewTokenDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, scope: "read" | "write" | "admin") => void }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write" | "admin">("read");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-lg border border-border bg-popover shadow-2xl">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Create API token</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Tokens grant programmatic access. Treat them like passwords.</p>
        </div>
        <div className="p-4 space-y-3">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. github-actions-deploy"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">Scope</div>
            <div className="flex gap-1.5">
              {(["read", "write", "admin"] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)} className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider",
                  scope === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}>{s}</button>
              ))}
            </div>
          </label>
        </div>
        <div className="border-t border-border px-4 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border bg-surface/60 px-3 py-1.5 text-sm hover:bg-surface">Cancel</button>
          <button disabled={!name} onClick={() => { onCreate(name, scope); onClose(); }}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            Create token
          </button>
        </div>
      </div>
    </div>
  );
}
