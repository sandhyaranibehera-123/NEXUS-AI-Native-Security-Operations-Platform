import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ListFilter as Filter, Pause, Play, Search } from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";
import { SEED_EVENTS } from "@/lib/mock/generators";
import { useInspector } from "@/lib/inspector-store";
import { useLiveEvents } from "@/lib/realtime";
import { useEvents } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-store";
import type { Severity, SecurityEvent } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/events")({
  head: () => ({
    meta: [
      { title: "Security Events — NEXUS" },
      { name: "description", content: "Realtime SIEM event explorer." },
    ],
  }),
  component: EventsPage,
});

const SEVERITY_OPTS: Severity[] = ["critical", "high", "medium", "info", "healthy"];

function EventsPage() {
  const user = useAuth((s) => s.user);
  const { events: live, status: streamStatus } = useLiveEvents(30, 1200);
  const { data: apiData, isError: apiError } = useEvents({
    limit: 200,
    search: undefined,
    severity: undefined,
  });
  const [streamOn, setStreamOn] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Severity[]>(["critical", "high", "medium", "info"]);
  const openInspector = useInspector((s) => s.open);

  const apiEvents = useMemo<SecurityEvent[]>(() => {
    if (!apiData?.items || apiError) return [];
    return apiData.items.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      type: e.type as SecurityEvent["type"],
      severity: e.severity as Severity,
      source: e.source,
      sourceIp: e.sourceIp ?? "",
      destIp: e.destIp ?? "",
      user: e.user ?? "",
      host: e.host ?? "",
      rule: e.rule ?? "",
      message: e.message,
      country: e.country ?? "",
      asset: e.asset ?? "",
      mitre: e.mitre ?? "",
      raw: e.raw ?? {},
    }));
  }, [apiData, apiError]);

  const merged = useMemo<SecurityEvent[]>(() => {
    const base = user && apiEvents.length > 0 ? apiEvents : SEED_EVENTS;
    return streamOn ? [...live, ...base] : base;
  }, [live, streamOn, apiEvents, user]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return merged
      .filter((e) => active.includes(e.severity))
      .filter((e) =>
        !q ||
        e.message.toLowerCase().includes(q) ||
        e.user.toLowerCase().includes(q) ||
        e.host.toLowerCase().includes(q) ||
        e.sourceIp.includes(q) ||
        e.rule.toLowerCase().includes(q) ||
        e.type.includes(q),
      )
      .slice(0, 400);
  }, [merged, query, active]);

  const toggle = (s: Severity) =>
    setActive((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <div className="p-6 space-y-4 max-w-[1700px] mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">SIEM / Events</div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Events</h1>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {filtered.length.toLocaleString()} of {merged.length.toLocaleString()} events
        </div>
      </div>

      {/* Query bar */}
      <div className="rounded-lg border border-border bg-surface/60">
        <div className="flex flex-wrap items-center gap-2 p-2.5 border-b border-border">
          <div className="flex items-center gap-2 flex-1 min-w-[260px] rounded-md border border-border bg-background px-3 py-1.5">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Query… e.g. severity:critical user:root host:edge-*'
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground font-mono"
            />
            <span className="text-[10px] font-mono text-muted-foreground">/</span>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
            <Filter className="ml-2 mr-1 size-3.5 text-muted-foreground" />
            {SEVERITY_OPTS.map((s) => (
              <button
                key={s}
                onClick={() => toggle(s)}
                className={cn(
                  "rounded px-2 py-1 text-[11px] font-mono uppercase tracking-wider",
                  active.includes(s) ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStreamOn((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-mono uppercase tracking-wider",
              streamOn ? "border-healthy/40 bg-healthy/10 text-healthy" : "border-border bg-background text-muted-foreground",
            )}
          >
            {streamOn ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {streamOn ? "streaming" : "paused"}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Sev</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Message</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Host</th>
                <th className="px-4 py-2 font-medium">Source IP</th>
                <th className="px-4 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => openInspector({ kind: "event", event: e })}
                  className="hover:bg-accent/40 cursor-pointer"
                >
                  <td className="px-4 py-2 text-[11px] font-mono text-muted-foreground whitespace-nowrap tabular-nums">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2"><SeverityBadge severity={e.severity} /></td>
                  <td className="px-4 py-2 text-[11px] font-mono">{e.type}</td>
                  <td className="px-4 py-2 max-w-[420px] truncate">{e.message}</td>
                  <td className="px-4 py-2 text-[12px] font-mono">{e.user}</td>
                  <td className="px-4 py-2 text-[12px] font-mono">{e.host}</td>
                  <td className="px-4 py-2 text-[12px] font-mono text-muted-foreground">{e.sourceIp}</td>
                  <td className="px-4 py-2 text-[11px] font-mono text-muted-foreground">{e.source}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No events match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
