import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";
import { SEED_INCIDENTS } from "@/lib/mock/generators";
import { useInspector } from "@/lib/inspector-store";
import { useIncidentStore } from "@/lib/incident-store";
import { useIncidents } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-store";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Incident, IncidentStatus } from "@/lib/mock/types";

export const Route = createFileRoute("/_app/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents — NEXUS" },
      { name: "description", content: "Active and historical security incidents." },
    ],
  }),
  component: IncidentsPage,
});

const STATUSES: IncidentStatus[] = ["open", "investigating", "contained", "resolved"];

const STATUS_STYLE: Record<IncidentStatus, string> = {
  open: "bg-critical/15 text-critical border-critical/40",
  investigating: "bg-high/15 text-high border-high/40",
  contained: "bg-info/15 text-info border-info/40",
  resolved: "bg-healthy/15 text-healthy border-healthy/40",
};

function IncidentsPage() {
  const user = useAuth((s) => s.user);
  const { data: apiData, isError: apiError } = useIncidents({ limit: 50 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<IncidentStatus[]>(["open", "investigating", "contained"]);
  const [starredOnly, setStarredOnly] = useState(false);
  const openInspector = useInspector((s) => s.open);
  const overrides = useIncidentStore((s) => s.overrides);

  const apiIncidents = useMemo<Incident[]>(() => {
    if (!apiData?.items || apiError) return [];
    return apiData.items.map((i) => ({
      id: i.id,
      code: i.code,
      title: i.title,
      severity: i.severity as Incident["severity"],
      status: (i.status === "eradicated" || i.status === "recovered" || i.status === "closed"
        ? "resolved" : i.status) as IncidentStatus,
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
    }));
  }, [apiData, apiError]);

  const baseIncidents = user && apiIncidents.length > 0 ? apiIncidents : SEED_INCIDENTS;

  const merged: Incident[] = useMemo(
    () => baseIncidents.map((i) => ({
      ...i,
      status: overrides[i.code]?.status ?? i.status,
      assignee: overrides[i.code]?.assignee ?? i.assignee,
    })),
    [baseIncidents, overrides],
  );

  const filtered = useMemo(() => {
    const qq = q.toLowerCase().trim();
    return merged
      .filter((i) => status.includes(i.status))
      .filter((i) => !starredOnly || overrides[i.code]?.starred)
      .filter((i) => !qq || i.title.toLowerCase().includes(qq) || i.code.toLowerCase().includes(qq) || i.assignee.includes(qq));
  }, [q, status, merged, overrides, starredOnly]);

  const counts = useMemo(() => {
    const c: Record<IncidentStatus, number> = { open: 0, investigating: 0, contained: 0, resolved: 0 };
    merged.forEach((i) => { c[i.status]++; });
    return c;
  }, [merged]);

  return (
    <div className="p-6 space-y-4 max-w-[1700px] mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Response / Incidents</div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <div key={s} className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{s}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{counts[s]}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface/60">
        <div className="flex flex-wrap items-center gap-2 p-2.5 border-b border-border">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-md border border-border bg-background px-3 py-1.5">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Filter incidents by title, code, assignee…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus((prev) => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                className={cn(
                  "rounded px-2 py-1 text-[11px] font-mono uppercase tracking-wider",
                  status.includes(s) ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >{s}</button>
            ))}
          </div>
          <button
            onClick={() => setStarredOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wider",
              starredOnly ? "border-high/40 bg-high/10 text-high" : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            <Star className={cn("size-3.5", starredOnly && "fill-high")} /> starred
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
              <th className="px-4 py-2 font-medium">Severity</th>
              <th className="px-4 py-2 font-medium">Incident</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Assignee</th>
              <th className="px-4 py-2 font-medium">Impact</th>
              <th className="px-4 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((i) => (
              <tr key={i.id} className="hover:bg-accent/40 group">
                <td className="px-4 py-3"><SeverityBadge severity={i.severity} /></td>
                <td className="px-4 py-3">
                  <Link to="/incidents/$incidentId" params={{ incidentId: i.code }} className="block group-hover:underline">
                    <div className="text-[11px] font-mono text-muted-foreground">{i.code}</div>
                    <div className="text-sm leading-snug">{i.title}</div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-mono", STATUS_STYLE[i.status])}>
                    {i.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px]">{i.category}</td>
                <td className="px-4 py-3 text-[12px] font-mono">{i.assignee}</td>
                <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{i.affectedAssets} assets • {i.affectedUsers} users</td>
                <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })}
                </td>
                <td className="px-2 py-3 text-right">
                  <button
                    onClick={() => openInspector({ kind: "incident", incident: i })}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
