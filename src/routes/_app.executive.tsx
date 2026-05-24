import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/metric-card";
import { makeMetricSeries } from "@/lib/mock/generators";
import { ChartBar as BarChart3, Shield, TrendingDown, Clock, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, DollarSign, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/executive")({
  head: () => ({ meta: [{ title: "Executive Dashboard — NEXUS" }] }),
  component: ExecutiveDashboard,

});

const RISK_TRENDS = [
  { label: "Critical", value: 3, max: 10, color: "critical" },
  { label: "High", value: 12, max: 30, color: "high" },
  { label: "Medium", value: 28, max: 50, color: "medium" },
  { label: "Low", value: 45, max: 60, color: "info" },
];

const COMPLIANCE = [
  { framework: "CIS AWS", score: 87, trend: "+2" },
  { framework: "SOC 2 Type II", score: 94, trend: "+1" },
  { framework: "PCI DSS", score: 78, trend: "-3" },
  { framework: "HIPAA", score: 91, trend: "0" },
  { framework: "FedRAMP", score: 82, trend: "+4" },
];

const FINANCIAL = [
  { metric: "Avg incident cost", value: "$47K", trend: "-12%" },
  { metric: "Downtime cost (MTD)", value: "$184K", trend: "-8%" },
  { metric: "Remediation spend", value: "$2.1M/YTD", trend: "+3%" },
  { metric: "Risk exposure", value: "$8.4M", trend: "-18%" },
];

const SLA = [
  { metric: "Critical response", target: "<5m", actual: "3.2m", met: true },
  { metric: "High response", target: "<15m", actual: "8.5m", met: true },
  { metric: "Containment time", target: "<1h", actual: "42m", met: true },
  { metric: "Recovery time", target: "<4h", actual: "4.8h", met: false },
  { metric: "Postmortem delivery", target: "<48h", actual: "36h", met: true },
];

function ExecutiveDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Executive Dashboard</h1>
        <span className="text-[10px] font-mono text-muted-foreground">Last updated: 2m ago</span>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Risk Posture" value="7.2/10" delta={{ v: "0.8", up: false }} icon={Shield} tone="healthy" series={makeMetricSeries(72, 40)} />
        <MetricCard label="Open Incidents" value="7" delta={{ v: "2", up: false }} icon={AlertTriangle} tone="high" series={makeMetricSeries(7, 40)} />
        <MetricCard label="SLA Compliance" value="89%" icon={Clock} tone="default" series={makeMetricSeries(89, 40)} />
        <MetricCard label="Mean Time to Detect" value="42ms" icon={Activity} tone="info" series={makeMetricSeries(42, 40)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Posture */}
        <div className="rounded-lg border border-border bg-surface/60 p-5 space-y-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Risk Posture by Severity</div>
          {RISK_TRENDS.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1">
                <span>{r.label}</span>
                <span className="font-mono">{r.value}</span>
              </div>
              <Progress value={(r.value / r.max) * 100} className="h-2" />
            </div>
          ))}
          <div className="pt-3 border-t border-border flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-healthy" />
            <span className="text-xs text-muted-foreground">Risk score trending down 8% this month</span>
          </div>
        </div>

        {/* Compliance */}
        <div className="rounded-lg border border-border bg-surface/60 p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Compliance Posture</div>
          {COMPLIANCE.map((c) => (
            <div key={c.framework} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span>{c.framework}</span>
                  <span className="font-mono">{c.score}%</span>
                </div>
                <Progress value={c.score} className="h-1.5" />
              </div>
              <span className={cn("text-[9px] font-mono", c.trend.startsWith("+") ? "text-healthy" : c.trend.startsWith("-") ? "text-high" : "text-muted-foreground")}>{c.trend}</span>
            </div>
          ))}
        </div>

        {/* Financial Impact */}
        <div className="rounded-lg border border-border bg-surface/60 p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Financial Impact</div>
          {FINANCIAL.map((f) => (
            <div key={f.metric} className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">{f.metric}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{f.value}</span>
                <span className={cn("text-[9px] font-mono", f.trend.startsWith("-") ? "text-healthy" : "text-high")}>{f.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SLA + Attack Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-surface/60">
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">SLA Performance</span>
          </div>
          <div className="divide-y divide-border">
            {SLA.map((s) => (
              <div key={s.metric} className="flex items-center gap-3 px-4 py-2.5">
                {s.met ? <CheckCircle2 className="h-4 w-4 text-healthy" /> : <AlertTriangle className="h-4 w-4 text-high" />}
                <div className="flex-1">
                  <div className="text-sm">{s.metric}</div>
                  <div className="text-xs text-muted-foreground">Target: {s.target} | Actual: {s.actual}</div>
                </div>
                <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded", s.met ? "bg-healthy/10 text-healthy border border-healthy/30" : "bg-high/10 text-high border border-high/30")}>
                  {s.met ? "MET" : "BREACHED"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface/60 p-5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">Attack Trends (30 Day)</div>
          <div className="space-y-3">
            {[
              { type: "Phishing", count: 47, change: "+23%", severity: "high" },
              { type: "Brute Force", count: 312, change: "-5%", severity: "medium" },
              { type: "Malware", count: 8, change: "+2%", severity: "high" },
              { type: "Insider Threat", count: 3, change: "0%", severity: "critical" },
              { type: "Supply Chain", count: 1, change: "+1", severity: "critical" },
            ].map((a) => (
              <div key={a.type} className="flex items-center gap-3">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm flex-1">{a.type}</span>
                <span className="text-sm font-mono">{a.count}</span>
                <span className={cn("text-[9px] font-mono", a.change.startsWith("+") && a.change !== "+1" ? "text-high" : a.change.startsWith("-") ? "text-healthy" : "text-muted-foreground")}>{a.change}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
