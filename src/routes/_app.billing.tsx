import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/metric-card";
import { makeMetricSeries } from "@/lib/mock/generators";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Users, Database, Bot, TrendingUp, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({ meta: [{ title: "Billing — NEXUS" }] }),
  component: BillingPage,

});

const SEATS = [
  { name: "Sarah Chen", role: "admin", lastActive: "2m ago" },
  { name: "James Miller", role: "analyst", lastActive: "5m ago" },
  { name: "Priya Sharma", role: "analyst", lastActive: "1h ago" },
  { name: "Alex Rivera", role: "viewer", lastActive: "1d ago" },
  { name: "Morgan Lee", role: "analyst", lastActive: "3m ago" },
];

const HISTORY = [
  { date: "May 1, 2026", amount: "$4,200.00", status: "paid" },
  { date: "Apr 1, 2026", amount: "$3,850.00", status: "paid" },
  { date: "Mar 1, 2026", amount: "$3,850.00", status: "paid" },
  { date: "Feb 1, 2026", amount: "$3,200.00", status: "paid" },
];

const USAGE = [
  { label: "Events Ingested", current: 2.1, limit: 3, unit: "B" },
  { label: "AI Queries", current: 1200, limit: 2000, unit: "" },
  { label: "Endpoints", current: 2847, limit: 5000, unit: "" },
  { label: "Storage", current: 420, limit: 1000, unit: "GB" },
];

const INGESTION = [
  { source: "API", pct: 45 },
  { source: "Agent", pct: 35 },
  { source: "Syslog", pct: 15 },
  { source: "Custom", pct: 5 },
];

function BillingPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Billing & Usage</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Monthly Spend" value="$4,200" icon={CreditCard} tone="default" series={makeMetricSeries(4200, 40)} />
        <MetricCard label="Seats Used" value="47/100" icon={Users} tone="info" series={makeMetricSeries(47, 40)} />
        <MetricCard label="Events/Mo" value="2.1B" icon={Database} tone="healthy" series={makeMetricSeries(2100, 40)} />
        <MetricCard label="AI Queries" value="1.2K" icon={Bot} tone="default" series={makeMetricSeries(1200, 40)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan */}
        <div className="rounded-lg border border-border bg-surface/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Current Plan</div>
              <div className="text-lg font-semibold mt-1">Enterprise</div>
            </div>
            <span className="text-[9px] font-mono px-2 py-1 rounded border border-primary/30 bg-primary/10 text-primary">Active</span>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><TrendingUp className="h-3 w-3 text-healthy" />Unlimited workspaces</div>
            <div className="flex items-center gap-2"><Database className="h-3 w-3 text-info" />3B events/month</div>
            <div className="flex items-center gap-2"><Bot className="h-3 w-3 text-primary" />2,000 AI queries/day</div>
            <div className="flex items-center gap-2"><Users className="h-3 w-3 text-info" />100 seats included</div>
          </div>
        </div>

        {/* Usage */}
        <div className="rounded-lg border border-border bg-surface/60 p-5 space-y-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Usage Quotas</div>
          {USAGE.map((u) => (
            <div key={u.label}>
              <div className="flex justify-between text-xs mb-1">
                <span>{u.label}</span>
                <span className="font-mono">{u.current}{u.unit} / {u.limit}{u.unit}</span>
              </div>
              <Progress value={(u.current / u.limit) * 100} className="h-1.5" />
            </div>
          ))}
        </div>

        {/* Ingestion Sources */}
        <div className="rounded-lg border border-border bg-surface/60 p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Ingestion by Source</div>
          {INGESTION.map((s) => (
            <div key={s.source} className="flex items-center gap-3">
              <span className="text-xs w-16 shrink-0">{s.source}</span>
              <div className="flex-1 h-2 bg-background rounded overflow-hidden">
                <div className="h-full bg-primary/60 rounded" style={{ width: `${s.pct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{s.pct}%</span>
            </div>
          ))}
        </div>

        {/* Seats */}
        <div className="rounded-lg border border-border bg-surface/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Seat Management</div>
            <span className="text-xs font-mono text-muted-foreground">47 / 100</span>
          </div>
          <div className="space-y-1.5">
            {SEATS.map((s) => (
              <div key={s.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface transition-colors">
                <span className="flex h-6 w-6 items-center justify-center rounded text-[9px] font-mono font-bold bg-primary/20 text-primary">
                  {s.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <span className="text-sm flex-1">{s.name}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border">{s.role}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{s.lastActive}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="rounded-lg border border-border bg-surface/60">
        <div className="px-4 py-2 border-b border-border">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Billing History</span>
        </div>
        <div className="divide-y divide-border">
          {HISTORY.map((h) => (
            <div key={h.date} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm">{h.date}</span>
              <span className="text-sm font-mono font-medium">{h.amount}</span>
              <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border border-healthy/30 bg-healthy/10 text-healthy">{h.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
