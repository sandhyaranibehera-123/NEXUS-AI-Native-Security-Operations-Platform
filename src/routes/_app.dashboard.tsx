import { createFileRoute } from "@tanstack/react-router";
import { Activity, TriangleAlert as AlertTriangle, Boxes, Cloud, FingerprintPattern as Fingerprint, Gauge, ShieldAlert, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useMemo } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { MetricCard } from "@/components/metric-card";
import { SeverityBadge } from "@/components/severity-badge";
import { WorkspaceContext } from "@/components/workspace-context";
import { useInspector } from "@/lib/inspector-store";
import { SEED_EVENTS, SEED_INCIDENTS, makeMetricSeries } from "@/lib/mock/generators";
import { useLiveEvents } from "@/lib/realtime";
import { useDashboardStats, useIncidents } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-store";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview — NEXUS" },
      { name: "description", content: "Realtime security operations overview." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const user = useAuth((s) => s.user);
  const { data: stats } = useDashboardStats();
  const { data: apiIncidents } = useIncidents({ limit: 6 });
  const { events: live, status: streamStatus } = useLiveEvents(40, 1400);
  const openInspector = useInspector((s) => s.open);

  const metricSeries = useMemo(() => ({
    threats: makeMetricSeries(36, 60, 14),
    score: makeMetricSeries(36, 78, 6),
    endpoints: makeMetricSeries(36, 92, 3),
    vulns: makeMetricSeries(36, 240, 12),
    incidents: makeMetricSeries(36, 8, 3),
    blocked: makeMetricSeries(36, 1800, 200),
    cloud: makeMetricSeries(36, 64, 5),
    identity: makeMetricSeries(36, 71, 7),
  }), []);

  const threatTrend = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    h: `${i.toString().padStart(2, "0")}:00`,
    critical: Math.round(Math.random() * 8 + (i > 10 && i < 18 ? 6 : 0)),
    high: Math.round(Math.random() * 14 + 4),
    medium: Math.round(Math.random() * 20 + 8),
  })), []);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    SEED_EVENTS.forEach((e) => { counts[e.type] = (counts[e.type] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([type, count]) => ({ type: type.replace(/_/g, " "), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, []);

  const recentIncidents = user && apiIncidents?.items?.length
    ? apiIncidents.items.map((i) => ({
        id: i.id,
        code: i.code,
        title: i.title,
        severity: i.severity,
        status: i.status,
        assignee: i.assignee ?? "Unassigned",
        openedAt: i.openedAt,
        updatedAt: i.updatedAt,
        affectedAssets: i.affectedAssets,
        affectedUsers: i.affectedUsers,
        category: i.category ?? "",
        mitre: i.mitre,
        summary: i.summary ?? "",
        timeline: i.timeline,
        rca: i.rca ?? "",
        recommendations: i.recommendations,
        linkedEventIds: i.linkedEventIds,
      }))
    : SEED_INCIDENTS.slice(0, 6);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Operations / Overview</div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Operations Center</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-border bg-surface/60 px-3 py-1.5 text-sm hover:bg-surface">
            Export
          </button>
          <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Sparkles className="size-3.5" /> Ask Copilot
          </button>
        </div>
      </div>

      <WorkspaceContext />



      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active Threats" value={47} delta={{ v: "12%", up: true }} icon={ShieldAlert} tone="critical" series={metricSeries.threats} />
        <MetricCard label="Threat Score" value="78 / 100" delta={{ v: "4 pts", up: true }} icon={Gauge} tone="high" series={metricSeries.score} />
        <MetricCard label="Endpoint Health" value="98.4%" delta={{ v: "0.2%", up: false }} icon={ShieldCheck} tone="healthy" series={metricSeries.endpoints} />
        <MetricCard label="Open Vulnerabilities" value={244} delta={{ v: "8", up: false }} icon={Boxes} tone="info" series={metricSeries.vulns} />
        <MetricCard label="Active Incidents" value={12} delta={{ v: "3", up: true }} icon={AlertTriangle} tone="critical" series={metricSeries.incidents} />
        <MetricCard label="Blocked Attacks (24h)" value="1,948" delta={{ v: "11%", up: true }} icon={Zap} tone="default" series={metricSeries.blocked} />
        <MetricCard label="Cloud Risk Score" value={64} delta={{ v: "2", up: false }} icon={Cloud} tone="info" series={metricSeries.cloud} />
        <MetricCard label="Identity Risk Score" value={71} delta={{ v: "5", up: true }} icon={Fingerprint} tone="high" series={metricSeries.identity} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Threat trend</div>
              <div className="text-sm font-medium">Detections by severity, last 24h</div>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <Legend dot="bg-critical" label="critical" />
              <Legend dot="bg-high" label="high" />
              <Legend dot="bg-medium" label="medium" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={threatTrend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-crit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.23 25)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.62 0.23 25)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-high" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 50)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 50)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-med" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.82 0.16 95)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.82 0.16 95)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.30 0.014 250 / 0.3)" vertical={false} />
                <XAxis dataKey="h" stroke="oklch(0.55 0.015 245)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.55 0.015 245)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.013 250)",
                    border: "1px solid oklch(0.38 0.018 250 / 0.6)",
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="medium" stackId="1" stroke="oklch(0.82 0.16 95)" fill="url(#g-med)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="high" stackId="1" stroke="oklch(0.72 0.18 50)" fill="url(#g-high)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="critical" stackId="1" stroke="oklch(0.62 0.23 25)" fill="url(#g-crit)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface/60 p-4">
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Detections by type</div>
            <div className="text-sm font-medium">Last 24 hours</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byType} layout="vertical" margin={{ left: 10, right: 8, top: 0, bottom: 0 }}>
                <CartesianGrid stroke="oklch(0.30 0.014 250 / 0.25)" horizontal={false} />
                <XAxis type="number" stroke="oklch(0.55 0.015 245)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="type" stroke="oklch(0.7 0.01 245)" fontSize={10} tickLine={false} axisLine={false} width={110} />
                <Tooltip cursor={{ fill: "oklch(0.30 0.018 250 / 0.4)" }} contentStyle={{ background: "oklch(0.20 0.013 250)", border: "1px solid oklch(0.38 0.018 250 / 0.6)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="oklch(0.72 0.16 245)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stream + incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface/60">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <span className="text-sm font-medium">Live attack stream</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">simulated</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
              <span className="size-1.5 rounded-full bg-healthy pulse-dot text-healthy" />
              streaming
            </div>
          </div>
          <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {live.map((e) => (
              <li
                key={e.id}
                onClick={() => openInspector({ kind: "event", event: e })}
                className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-4 py-2 text-sm hover:bg-accent/40 cursor-pointer"
              >
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
                <SeverityBadge severity={e.severity} />
                <span className="truncate">{e.message}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{e.source}</span>
              </li>
            ))}
            {live.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">Awaiting events…</li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-surface/60">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-high" />
              <span className="text-sm font-medium">Active incidents</span>
            </div>
            <a href="/incidents" className="text-[11px] font-mono text-muted-foreground hover:text-foreground">view all →</a>
          </div>
          <ul className="divide-y divide-border">
            {recentIncidents.map((i) => (
              <li
                key={i.id}
                onClick={() => openInspector({ kind: "incident", incident: i })}
                className="px-4 py-3 hover:bg-accent/40 cursor-pointer space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={i.severity} />
                  <span className="text-[11px] font-mono text-muted-foreground">{i.code}</span>
                  <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                    {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-sm leading-snug line-clamp-2">{i.title}</div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  {i.affectedAssets} assets • {i.affectedUsers} users • {i.assignee}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={`size-2 rounded-sm ${dot}`} />{label}
    </span>
  );
}
