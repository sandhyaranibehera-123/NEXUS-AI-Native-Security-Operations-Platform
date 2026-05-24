import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { MetricCard } from "@/components/metric-card";
import { makeMetricSeries } from "@/lib/mock/generators";
import { Users, Shield, Clock, TriangleAlert as AlertTriangle, UserPlus, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/ownership")({
  head: () => ({ meta: [{ title: "Service Ownership — NEXUS" }] }),
  component: OwnershipPage,

});

const SERVICES = [
  { name: "Web Platform", owner: "Sarah Chen", team: "Platform", tier: "L1", onCall: true, responseTime: "3.2m", escalationRate: "12%" },
  { name: "Data Pipeline", owner: "James Miller", team: "Data", tier: "L1", onCall: false, responseTime: "5.1m", escalationRate: "28%" },
  { name: "Cloud Infra", owner: "Priya Sharma", team: "Cloud", tier: "L2", onCall: true, responseTime: "2.8m", escalationRate: "8%" },
  { name: "Endpoint Fleet", owner: "Morgan Lee", team: "Security", tier: "L1", onCall: true, responseTime: "4.5m", escalationRate: "15%" },
  { name: "AI Engine", owner: "Alex Rivera", team: "ML", tier: "L2", onCall: false, responseTime: "7.2m", escalationRate: "35%" },
];

const UNASSIGNED = [
  { type: "alert", id: "ALT-4330", title: "Suspicious outbound from staging", severity: "high" as const },
  { type: "endpoint", id: "dev-ws-06", title: "Unmanaged workstation detected", severity: "medium" as const },
  { type: "vulnerability", id: "CVE-2025-5501", title: "Unassigned OpenSSL vuln", severity: "high" as const },
  { type: "incident", id: "INC-2849", title: "Phishing campaign — no responder", severity: "critical" as const },
];

const ONCALL = [
  { name: "Sarah Chen", role: "Primary", shift: "08:00–20:00", color: "#10b981" },
  { name: "Morgan Lee", role: "Primary", shift: "08:00–20:00", color: "#f59e0b" },
  { name: "James Miller", role: "Secondary", shift: "20:00–08:00", color: "#3b82f6" },
];

function OwnershipPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Service Ownership</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Services" value="5" icon={Users} tone="default" series={makeMetricSeries(5, 40)} />
        <MetricCard label="Avg Response" value="4.6m" icon={Clock} tone="info" series={makeMetricSeries(46, 40)} />
        <MetricCard label="Escalation Rate" value="19%" icon={AlertTriangle} tone="high" series={makeMetricSeries(19, 40)} />
        <MetricCard label="Unassigned" value="4" icon={Shield} tone="critical" series={makeMetricSeries(4, 40)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service catalog */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface/60">
          <div className="px-4 py-2 border-b border-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Service Catalog</span>
          </div>
          <div className="divide-y divide-border">
            {SERVICES.map((s) => (
              <div key={s.name} className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors">
                <span className={cn("h-2 w-2 rounded-full", s.onCall ? "bg-healthy" : "bg-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.team} • {s.owner}</div>
                </div>
                <div className="shrink-0 flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-muted-foreground">Tier {s.tier}</span>
                  <span>RT: {s.responseTime}</span>
                  <span className={cn(s.escalationRate > "25%" ? "text-high" : "text-muted-foreground")}>Esc: {s.escalationRate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* On-call */}
        <div className="rounded-lg border border-border bg-surface/60 p-4 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">On-Call Now</div>
          {ONCALL.map((o) => (
            <div key={o.name} className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-mono font-bold" style={{ backgroundColor: o.color + "30", color: o.color }}>
                {o.name.split(" ").map((n) => n[0]).join("")}
              </span>
              <div className="flex-1">
                <div className="text-sm">{o.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{o.role} • {o.shift}</div>
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-border">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Escalation Chain</div>
            <div className="flex items-center gap-1 text-xs">
              {["L1", "L2", "L3", "Mgmt"].map((t, i) => (
                <span key={t} className="flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded border border-border bg-background font-mono text-[10px]">{t}</span>
                  {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Unassigned */}
      <div className="rounded-lg border border-border bg-surface/60">
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-high" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Unassigned Entities</span>
        </div>
        <div className="divide-y divide-border">
          {UNASSIGNED.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface transition-colors">
              <SeverityBadge severity={u.severity} />
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border">{u.type}</span>
              <span className="text-xs font-mono">{u.id}</span>
              <span className="text-sm flex-1">{u.title}</span>
              <button className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1">
                <UserPlus className="h-3 w-3" />Assign
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
