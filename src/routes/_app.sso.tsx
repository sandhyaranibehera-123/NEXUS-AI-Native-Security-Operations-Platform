import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Key, Shield, Globe, Users, Lock, Clock, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_app/sso")({
  head: () => ({ meta: [{ title: "SSO & Identity — NEXUS" }] }),
  component: SSOPage,

});

const PROVIDERS = [
  { id: "saml", name: "SAML 2.0", connected: true, users: 23, lastSync: "5m ago", icon: Shield },
  { id: "okta", name: "Okta", connected: true, users: 18, lastSync: "2m ago", icon: Globe },
  { id: "azure", name: "Azure AD", connected: false, users: 0, lastSync: "—", icon: Users },
  { id: "google", name: "Google Workspace", connected: true, users: 6, lastSync: "15m ago", icon: Lock },
];

function SSOPage() {
  const [mfa, setMfa] = useState(true);
  const [jit, setJit] = useState(true);
  const [scim, setScim] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2"><Key className="h-5 w-5 text-primary" />SSO & Enterprise Identity</h1>

      {/* Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((p) => (
          <div key={p.id} className={cn("rounded-lg border bg-surface/60 p-5", p.connected ? "border-border" : "border-dashed border-border")}>
            <div className="flex items-center gap-3">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded", p.connected ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground")}>
                <p.icon className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.connected ? `${p.users} users synced` : "Not configured"}</div>
              </div>
              {p.connected ? (
                <span className="flex items-center gap-1 text-[9px] font-mono text-healthy"><CheckCircle2 className="h-3 w-3" />Connected</span>
              ) : (
                <button className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">Setup</button>
              )}
            </div>
            {p.connected && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Entity ID</span>
                  <span className="font-mono">nexus-{p.id}.example.com</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">SSO URL</span>
                  <span className="font-mono">https://sso.{p.id}.com/saml</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Last Sync</span>
                  <span className="font-mono text-muted-foreground">{p.lastSync}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface/60 p-5 space-y-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Security Settings</div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">MFA Enforcement</div><div className="text-xs text-muted-foreground">Require MFA for all SSO logins</div></div>
            <Switch checked={mfa} onCheckedChange={setMfa} />
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">Session Duration</div><div className="text-xs text-muted-foreground">SSO session valid for 8 hours</div></div>
            <span className="text-xs font-mono text-muted-foreground">8h</span>
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">Idle Timeout</div><div className="text-xs text-muted-foreground">Auto-lock after 30 min idle</div></div>
            <span className="text-xs font-mono text-muted-foreground">30m</span>
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">Remember Device</div><div className="text-xs text-muted-foreground">Trust device for 30 days after MFA</div></div>
            <Switch defaultChecked />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface/60 p-5 space-y-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Provisioning</div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">JIT Provisioning</div><div className="text-xs text-muted-foreground">Auto-create users on first SSO login</div></div>
            <Switch checked={jit} onCheckedChange={setJit} />
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">SCIM Sync</div><div className="text-xs text-muted-foreground">Automatic user/group sync from IdP</div></div>
            <Switch checked={scim} onCheckedChange={setScim} />
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">Group Mapping</div><div className="text-xs text-muted-foreground">Map IdP groups to NEXUS roles</div></div>
            <span className="text-xs font-mono text-muted-foreground">4 mappings</span>
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">Attribute Mapping</div><div className="text-xs text-muted-foreground">Email, name, department from IdP</div></div>
            <span className="text-xs font-mono text-muted-foreground">6 attrs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
