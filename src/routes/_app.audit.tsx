import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, KeyRound, User, FileText, Search } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { useAuditLog } from "@/lib/api-hooks";
import { useApiWithFallback } from "@/lib/use-api-with-fallback";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({ meta: [{ title: "Audit Log — NEXUS" }] }),
  component: AuditPage,
});

const FALLBACK = [
  { id: "1", actor: "k.morgan", action: "detection.rule.disabled", resourceType: "alert_rule", timestamp: new Date(Date.now() - 60_000).toISOString() },
  { id: "2", actor: "a.chen", action: "incident.assigned", resourceType: "incident", timestamp: new Date(Date.now() - 240_000).toISOString() },
  { id: "3", actor: "api-token:ci-bot", action: "search.export", resourceType: "events", timestamp: new Date(Date.now() - 720_000).toISOString() },
];

function AuditPage() {
  const [search, setSearch] = useState("");
  const query = useAuditLog(search || undefined);
  const { data: logs, isLive } = useApiWithFallback(query, FALLBACK);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Govern / Audit</div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          {isLive && (
            <p className="text-xs text-healthy mt-1">Live from database — append-only trail</p>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter actions, actors…"
            className="bg-transparent text-sm outline-none w-48"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Events / 24h" value={logs.length > 0 ? String(logs.length * 120) : "—"} icon={Activity} tone="info" />
        <MetricCard label="Unique actors" value={String(new Set(logs.map((l) => l.actor)).size)} icon={User} />
        <MetricCard label="Admin actions" value={String(logs.filter((l) => l.action.includes("rule") || l.action.includes("rbac")).length)} icon={KeyRound} tone="high" />
        <MetricCard label="Retention" value="7 years" icon={FileText} tone="healthy" />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider font-mono text-muted-foreground border-b border-border bg-surface/40">
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Resource</th>
              <th className="px-4 py-2">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((row) => (
              <tr key={row.id} className="hover:bg-accent/30">
                <td className="px-4 py-2 font-mono text-xs">{row.actor}</td>
                <td className="px-4 py-2 font-mono text-xs">{row.action}</td>
                <td className="px-4 py-2 text-muted-foreground">{row.resourceType ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(row.timestamp), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
