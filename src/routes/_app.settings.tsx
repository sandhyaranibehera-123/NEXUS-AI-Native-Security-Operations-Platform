import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings as SettingsIcon, Shield, Bell, Globe, Palette, Key, Plus, Trash2,
  RotateCcw, Building2, ArrowRight, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { usePrefs } from "@/lib/preferences-store";
import { useWorkspaceStore, type Environment, type Region } from "@/lib/workspace-store";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { WorkspaceContext } from "@/components/workspace-context";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — NEXUS" }] }),
  component: SettingsPage,
});

const TABS = [
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "regional", label: "Regional", icon: Globe },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SettingsPage() {
  const [tab, setTab] = useState<TabId>("security");
  const reset = usePrefs((s) => s.reset);
  const user = useAuth((s) => s.user);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <WorkspaceContext />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Govern · Configuration</p>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preferences persist locally for {user?.email ?? "your account"}.
          </p>
        </div>
        <button
          onClick={() => { reset(); toast.success("Settings restored to defaults"); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs font-mono hover:bg-surface"
        >
          <RotateCcw className="size-3.5" /> Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        {/* Tabs */}
        <nav className="space-y-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                tab === t.id ? "bg-primary/10 text-primary border border-primary/30"
                             : "text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent",
              )}>
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
          <Link to="/profile"
            className="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent mt-4">
            <span className="flex items-center gap-2"><Key className="size-4" /> Profile</span>
            <ArrowRight className="size-3 opacity-60" />
          </Link>
          <Link to="/organizations"
            className="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent">
            <span className="flex items-center gap-2"><Building2 className="size-4" /> Organization</span>
            <ArrowRight className="size-3 opacity-60" />
          </Link>
        </nav>

        {/* Panel */}
        <div className="rounded-lg border border-border bg-surface/40 p-6">
          {tab === "security" && <SecurityTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "workspace" && <WorkspaceTab />}
          {tab === "appearance" && <AppearanceTab />}
          {tab === "regional" && <RegionalTab />}
        </div>
      </div>
    </div>
  );
}

/* ------- Security ------- */
function SecurityTab() {
  const s = usePrefs((x) => x.security);
  const set = usePrefs((x) => x.setSecurity);
  const [newRange, setNewRange] = useState("");

  return (
    <Section icon={Shield} title="Security policy" desc="Applies to your session and workspace defaults.">
      <Field label="Multi-factor authentication" hint="WebAuthn or TOTP required at sign-in">
        <Switch checked={s.mfa} onCheckedChange={(v) => { set({ mfa: v }); toast.success("Saved"); }} />
      </Field>
      <Field label="Session timeout" hint="Auto sign-out after inactivity">
        <select value={s.sessionTimeoutMin} onChange={(e) => { set({ sessionTimeoutMin: +e.target.value }); toast.success("Saved"); }}
          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono">
          {[15, 30, 60, 120, 240, 480].map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
      </Field>
      <Field label="Password rotation" hint="Force change after N days">
        <select value={s.passwordRotationDays} onChange={(e) => set({ passwordRotationDays: +e.target.value })}
          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono">
          {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
      </Field>
      <Field label="IP allow-list" hint={`${s.ipAllowlist.length} ranges active`}>
        <Switch checked={s.ipAllowlistEnabled} onCheckedChange={(v) => set({ ipAllowlistEnabled: v })} />
      </Field>

      {s.ipAllowlistEnabled && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input value={newRange} onChange={(e) => setNewRange(e.target.value)}
              placeholder="10.0.0.0/8"
              className="flex-1 rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono outline-none focus:border-primary" />
            <button onClick={() => {
              if (!newRange) return;
              set({ ipAllowlist: [...s.ipAllowlist, newRange] }); setNewRange(""); toast.success("Range added");
            }} className="inline-flex items-center gap-1 rounded border border-border bg-surface/60 px-2.5 py-1.5 text-xs font-mono hover:bg-surface">
              <Plus className="size-3" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.ipAllowlist.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] font-mono">
                {r}
                <button onClick={() => set({ ipAllowlist: s.ipAllowlist.filter((x) => x !== r) })}
                  className="text-muted-foreground hover:text-critical">
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ------- Notifications ------- */
function NotificationsTab() {
  const n = usePrefs((x) => x.notifications);
  const set = usePrefs((x) => x.setNotifications);
  return (
    <Section icon={Bell} title="Notifications" desc="Choose how and when NEXUS reaches you.">
      {([
        ["email", "Email alerts"],
        ["push", "Push (mobile + desktop)"],
        ["slack", "Slack — #security-alerts"],
        ["webhook", "Webhook delivery"],
      ] as const).map(([k, label]) => (
        <Field key={k} label={label} hint="">
          <Switch checked={(n as any)[k]} onCheckedChange={(v) => { set({ [k]: v } as any); toast.success("Saved"); }} />
        </Field>
      ))}
      <Field label="Digest cadence" hint="Summary email schedule">
        <select value={n.digest} onChange={(e) => set({ digest: e.target.value as any })}
          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono">
          <option value="off">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
        </select>
      </Field>
      <Field label="Minimum severity" hint="Suppress anything below this level">
        <div className="flex gap-1">
          {(["info", "medium", "high", "critical"] as const).map((s) => (
            <button key={s} onClick={() => set({ minSeverity: s })}
              className={cn("rounded border px-2 py-1 text-[11px] font-mono uppercase",
                n.minSeverity === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s}
            </button>
          ))}
        </div>
      </Field>
    </Section>
  );
}

/* ------- Workspace ------- */
function WorkspaceTab() {
  const env = useWorkspaceStore((s) => s.environment);
  const region = useWorkspaceStore((s) => s.region);
  const setEnv = useWorkspaceStore((s) => s.setEnvironment);
  const setRegion = useWorkspaceStore((s) => s.setRegion);
  const ws = useWorkspaceStore((s) => s.workspaces);
  const active = useWorkspaceStore((s) => s.getActiveWorkspace());

  return (
    <Section icon={Building2} title="Workspace defaults" desc="These switch the entire UI scope.">
      <Field label="Environment" hint={env}>
        <div className="flex gap-1">
          {(["production", "staging", "development"] as Environment[]).map((e) => (
            <button key={e} onClick={() => { setEnv(e); toast.success(`Switched to ${e}`); }}
              className={cn("rounded border px-2.5 py-1 text-[11px] font-mono uppercase",
                env === e ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {e === "production" ? "prod" : e === "staging" ? "stage" : "dev"}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Region" hint="Default data residency">
        <select value={region} onChange={(e) => setRegion(e.target.value as Region)}
          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono">
          <option value="us-east-1">US East (us-east-1)</option>
          <option value="eu-west-1">EU West (eu-west-1)</option>
          <option value="ap-southeast-1">APAC (ap-southeast-1)</option>
        </select>
      </Field>
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">All workspaces</h4>
        <div className="space-y-2">
          {ws.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded border border-border bg-background/60 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{w.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{w.orgName} · {w.environment} · {w.region}</p>
              </div>
              {w.id === active.id && <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Active</Badge>}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------- Appearance ------- */
function AppearanceTab() {
  const ui = usePrefs((x) => x.ui);
  const set = usePrefs((x) => x.setUi);
  return (
    <Section icon={Palette} title="Appearance" desc="UI density and visualization preferences.">
      <Field label="Density" hint="Controls spacing across tables and cards">
        <div className="flex gap-1">
          {(["comfortable", "compact"] as const).map((d) => (
            <button key={d} onClick={() => set({ density: d })}
              className={cn("rounded border px-2.5 py-1 text-[11px] font-mono uppercase",
                ui.density === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {d}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Default landing page" hint="Where you go after sign-in">
        <select value={ui.defaultLanding} onChange={(e) => set({ defaultLanding: e.target.value as any })}
          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono">
          <option value="/dashboard">Dashboard</option>
          <option value="/executive">Executive view</option>
          <option value="/incidents">Incidents</option>
        </select>
      </Field>
      <Field label="Show heatmap on dashboard" hint="Geographic activity overlay">
        <Switch checked={ui.showHeatmap} onCheckedChange={(v) => set({ showHeatmap: v })} />
      </Field>
    </Section>
  );
}

/* ------- Regional ------- */
function RegionalTab() {
  const ui = usePrefs((x) => x.ui);
  const set = usePrefs((x) => x.setUi);
  return (
    <Section icon={Globe} title="Regional" desc="Date format and timezone for all timestamps.">
      <Field label="Date format" hint={ui.dateFormat.toUpperCase()}>
        <div className="flex gap-1">
          {([
            ["iso", "2026-05-28"], ["us", "05/28/2026"], ["eu", "28/05/2026"],
          ] as const).map(([k, sample]) => (
            <button key={k} onClick={() => set({ dateFormat: k as any })}
              className={cn("rounded border px-2.5 py-1 text-[11px] font-mono",
                ui.dateFormat === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {sample}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Timezone" hint={ui.timezone}>
        <select value={ui.timezone} onChange={(e) => set({ timezone: e.target.value })}
          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono">
          {["UTC", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Singapore", "Asia/Tokyo"].map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </Field>
      <Field label="Current time" hint="Live in selected timezone">
        <span className="text-xs font-mono text-foreground inline-flex items-center gap-1.5">
          <Clock className="size-3" /> {new Date().toLocaleTimeString(undefined, { timeZone: ui.timezone === "UTC" ? "UTC" : ui.timezone })}
        </span>
      </Field>
    </Section>
  );
}

/* ------- shared ------- */
function Section({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 pb-3 border-b border-border">
        <Icon className="size-5 text-primary mt-0.5" />
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
