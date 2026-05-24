import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { Switch } from "@/components/ui/switch";
import { Workflow, Zap, Bell, Globe, Ticket, Bot, Play, Clock, CircleCheck as CheckCircle2, Circle as XCircle, ArrowRight, Pause } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/automation")({
  head: () => ({ meta: [{ title: "Automation — NEXUS" }] }),
  component: AutomationPage,

});

interface WF {
  id: string; name: string; trigger: string; actions: string[]; status: "active" | "paused"; lastRun: Date; successRate: number;
}

const WORKFLOWS: WF[] = [
  { id: "wf-1", name: "Auto-Isolate Compromised Endpoint", trigger: "Critical malware detection", actions: ["Isolate endpoint", "Create incident", "Notify SOC"], status: "active", lastRun: new Date(Date.now() - 3600000), successRate: 98 },
  { id: "wf-2", name: "Auto-Escalate P1 Alerts", trigger: "Critical severity alert", actions: ["Escalate to SOC lead", "Page on-call", "Create Slack thread"], status: "active", lastRun: new Date(Date.now() - 600000), successRate: 100 },
  { id: "wf-3", name: "Suppress Known False Positives", trigger: "Health check DNS pattern", actions: ["Suppress alert", "Tag as FP", "Log suppression"], status: "active", lastRun: new Date(Date.now() - 1800000), successRate: 95 },
  { id: "wf-4", name: "Block Malicious IPs", trigger: "Threat intel IOC match", actions: ["Add to blocklist", "Notify firewall team", "Create case"], status: "active", lastRun: new Date(Date.now() - 7200000), successRate: 92 },
  { id: "wf-5", name: "Rotate Compromised Credentials", trigger: "Credential exposure detected", actions: ["Force password reset", "Revoke sessions", "Notify user"], status: "paused", lastRun: new Date(Date.now() - 86400000), successRate: 87 },
  { id: "wf-6", name: "Auto-Create Jira Ticket", trigger: "High severity alert unack 15m", actions: ["Create Jira ticket", "Assign to team", "Link alert"], status: "active", lastRun: new Date(Date.now() - 2400000), successRate: 100 },
];

function AutomationPage() {
  const [wfs, setWfs] = useState(WORKFLOWS);

  const toggleWf = (id: string) => setWfs((prev) => prev.map((w) => w.id === id ? { ...w, status: w.status === "active" ? "paused" : "active" } : w));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" />Automation Workflows</h1>

      {/* Workflows */}
      <div className="rounded-lg border border-border bg-surface/60">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Active Workflows</span>
          <button className="text-xs px-3 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"><Zap className="h-3 w-3" />Create Workflow</button>
        </div>
        <div className="divide-y divide-border">
          {wfs.map((wf) => (
            <div key={wf.id} className="px-4 py-3 hover:bg-surface transition-colors">
              <div className="flex items-center gap-3">
                <Switch checked={wf.status === "active"} onCheckedChange={() => toggleWf(wf.id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{wf.name}</span>
                    <span className={cn("text-[8px] font-mono px-1.5 py-0.5 rounded", wf.status === "active" ? "bg-healthy/10 text-healthy border border-healthy/30" : "bg-surface text-muted-foreground border border-border")}>
                      {wf.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Trigger: {wf.trigger}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono">{wf.successRate}% success</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{formatDistanceToNow(wf.lastRun, { addSuffix: true })}</div>
                </div>
              </div>
              {/* Action chain */}
              <div className="flex items-center gap-1.5 mt-2 ml-8 flex-wrap">
                {wf.actions.map((a, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-background border border-border">{a}</span>
                    {i < wf.actions.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: "Jira", status: "connected", icon: Ticket, lastDelivery: "2m ago", successRate: 100 },
          { name: "Slack", status: "connected", icon: Bell, lastDelivery: "30s ago", successRate: 99 },
          { name: "PagerDuty", status: "connected", icon: Globe, lastDelivery: "15m ago", successRate: 100 },
        ].map((int) => (
          <div key={int.name} className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="flex items-center gap-2">
              <int.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{int.name}</span>
              <span className="ml-auto flex items-center gap-1 text-[9px] font-mono text-healthy"><CheckCircle2 className="h-3 w-3" />{int.status}</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-muted-foreground">
              <span>Last: {int.lastDelivery}</span>
              <span>{int.successRate}% success</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
