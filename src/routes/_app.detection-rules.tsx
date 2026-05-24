import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Play, TestTube, GitBranch, Shield, Plus, Copy, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/detection-rules")({
  head: () => ({ meta: [{ title: "Detection Rules — NEXUS" }] }),
  component: DetectionRulesPage,

});

const RULES = [
  { id: "SIG-001", name: "Cobalt Strike C2 Beaconing", logSource: "network", severity: "critical" as const, status: "active", lastMatch: new Date(Date.now() - 180000), matches24h: 3 },
  { id: "SIG-002", name: "Suspicious PowerShell from Web Process", logSource: "process", severity: "high" as const, status: "active", lastMatch: new Date(Date.now() - 600000), matches24h: 7 },
  { id: "SIG-003", name: "DNS Beaconing Pattern", logSource: "dns", severity: "high" as const, status: "active", lastMatch: new Date(Date.now() - 1200000), matches24h: 2 },
  { id: "SIG-004", name: "VSS Delete — Ransomware Precursor", logSource: "process", severity: "critical" as const, status: "active", lastMatch: undefined, matches24h: 0 },
  { id: "SIG-005", name: "Brute Force Authentication", logSource: "auth", severity: "high" as const, status: "testing", lastMatch: new Date(Date.now() - 86400000), matches24h: 0 },
  { id: "SIG-006", name: "IAM Wildcard Policy Usage", logSource: "cloud", severity: "medium" as const, status: "active", lastMatch: new Date(Date.now() - 3600000), matches24h: 2 },
  { id: "SIG-007", name: "LOLBAS Execution", logSource: "process", severity: "high" as const, status: "disabled", lastMatch: new Date(Date.now() - 172800000), matches24h: 0 },
  { id: "SIG-008", name: "Excessive Data Transfer", logSource: "network", severity: "medium" as const, status: "active", lastMatch: new Date(Date.now() - 7200000), matches24h: 1 },
];

const TEMPLATES = [
  { name: "Authentication Anomaly", description: "Detect failed auth patterns and brute force", fields: ["user", "source_ip", "action", "count"] },
  { name: "Process Execution", description: "Monitor suspicious parent-child process relationships", fields: ["process_name", "parent_process", "command_line", "user"] },
  { name: "Network Beaconing", description: "Detect periodic outbound connections to C2 infrastructure", fields: ["destination_ip", "frequency", "bytes", "protocol"] },
  { name: "IAM Policy Change", description: "Alert on IAM privilege escalation and policy modifications", fields: ["role", "action", "resource", "principal"] },
];

function DetectionRulesPage() {
  const [rules, setRules] = useState(RULES);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Detection Rules</h1>
        <div className="flex gap-2">
          <button className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"><Plus className="h-3 w-3" />New Rule</button>
          <button className="text-xs px-3 py-1.5 rounded bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><Download className="h-3 w-3" />Import</button>
        </div>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="flex items-center gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Rules</TabsTrigger>
          <TabsTrigger value="builder" className="flex items-center gap-1.5 text-xs"><GitBranch className="h-3.5 w-3.5" />Builder</TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1.5 text-xs"><Copy className="h-3.5 w-3.5" />Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <div className="rounded-lg border border-border bg-surface/60 mt-4 divide-y divide-border">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors">
                <Switch checked={r.status === "active"} onCheckedChange={() => setRules((prev) => prev.map((rr) => rr.id === r.id ? { ...rr, status: rr.status === "active" ? "disabled" : "active" } : rr))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.name}</span>
                    <SeverityBadge severity={r.severity} />
                    <span className={cn("text-[8px] font-mono px-1.5 py-0.5 rounded", r.status === "active" ? "bg-healthy/10 text-healthy border border-healthy/30" : r.status === "testing" ? "bg-medium/10 text-medium border border-medium/30" : "bg-surface text-muted-foreground border border-border")}>
                      {r.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-muted-foreground">
                    <span>{r.id}</span>
                    <span>•</span>
                    <span>{r.logSource}</span>
                    <span>•</span>
                    <span>{r.matches24h} matches/24h</span>
                    {r.lastMatch && <><span>•</span><span>Last: {formatDistanceToNow(r.lastMatch, { addSuffix: true })}</span></>}
                  </div>
                </div>
                <button className="text-xs px-2 py-1 rounded bg-surface hover:bg-background border border-border text-muted-foreground flex items-center gap-1"><Play className="h-3 w-3" />Test</button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="builder">
          <div className="rounded-lg border border-border bg-surface/60 mt-4 p-5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">Condition Builder</div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">AND</span>
                <select className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"><option>event_type</option><option>source</option><option>severity</option></select>
                <select className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"><option>equals</option><option>contains</option><option>matches</option></select>
                <input className="bg-background border border-border rounded px-2 py-1 text-xs font-mono flex-1" placeholder="network" />
                <button className="text-xs text-muted-foreground hover:text-foreground">+</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">AND</span>
                <select className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"><option>frequency</option><option>count</option></select>
                <select className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"><option>greater_than</option><option>less_than</option></select>
                <input className="bg-background border border-border rounded px-2 py-1 text-xs font-mono w-20" placeholder="5" />
                <select className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"><option>/min</option><option>/hour</option></select>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:text-foreground">+ Add OR group</button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Generated Query</div>
              <div className="bg-background p-3 rounded font-mono text-xs text-muted-foreground">event_type = "network" AND frequency &gt; 5/min AND destination_port IN (443, 8443)</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {TEMPLATES.map((t) => (
              <div key={t.name} className="rounded-lg border border-border bg-surface/60 p-4">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.fields.map((f) => (
                    <span key={f} className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-border bg-background">{f}</span>
                  ))}
                </div>
                <button className="mt-3 text-xs px-3 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">Use Template</button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
