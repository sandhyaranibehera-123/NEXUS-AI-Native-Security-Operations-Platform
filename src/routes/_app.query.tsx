import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Terminal, Play, Save, Clock, FileText, Search, Sparkles, RotateCcw, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/query")({
  head: () => ({ meta: [{ title: "Query Language — NEXUS" }] }),
  component: QueryPage,

});

const SAVED = [
  { id: "sq-1", name: "Failed Auth Analysis", query: "event_type:auth action:failed | stats count by source_ip", lastRun: new Date(Date.now() - 1800000), results: 47 },
  { id: "sq-2", name: "DNS Beaconing Hunt", query: "event_type:dns type:TXT response_size>200 | timechart count", lastRun: new Date(Date.now() - 3600000), results: 12 },
  { id: "sq-3", name: "Process Parent-Child Anomaly", query: "event_type:process WHERE parent NOT IN (explorer.exe,svchost.exe) AND name IN (powershell,cmd)", lastRun: new Date(Date.now() - 7200000), results: 3 },
  { id: "sq-4", name: "IAM Escalation Audit", query: "event_type:iam action:role_assume role:admin | table user,role,timestamp", lastRun: new Date(Date.now() - 86400000), results: 8 },
  { id: "sq-5", name: "Cloud Resource Drift", query: "event_type:cloud action:create OR action:delete source!=terraform | stats count by resource_type", lastRun: new Date(Date.now() - 43200000), results: 5 },
];

const HISTORY = [
  { query: "event_type:network bytes_out>100MB", time: new Date(Date.now() - 600000), results: 7 },
  { query: "event_type:process name:powershell parent:w3wp.exe", time: new Date(Date.now() - 1800000), results: 2 },
  { query: "severity:critical status:open | count", time: new Date(Date.now() - 3600000), results: 4 },
  { query: "event_type:dns domain:*.nexus-cdn.net", time: new Date(Date.now() - 7200000), results: 156 },
  { query: "source_ip:185.220.101.34 | sort timestamp", time: new Date(Date.now() - 10800000), results: 47 },
];

const TEMPLATES = [
  { name: "Authentication Analysis", description: "Analyze failed auth patterns", query: "event_type:auth action:failed | stats count by source_ip, user | sort -count" },
  { name: "Network Beaconing", description: "Find periodic outbound connections", query: "event_type:network dst_port:443 | timechart span=5m count by destination_ip" },
  { name: "Process Anomaly", description: "Detect suspicious parent-child processes", query: "event_type:process WHERE name IN (powershell,cmd.exe) AND parent NOT IN (explorer.exe)" },
  { name: "IAM Review", description: "Audit privilege escalation events", query: "event_type:iam action:role_assume | stats count by user, role | where role=admin" },
  { name: "Cloud Activity", description: "Monitor unauthorized cloud changes", query: "event_type:cloud (action:create OR action:delete) source!=terraform | table timestamp,resource,actor" },
];

const MOCK_RESULTS = [
  { timestamp: "2026-05-23T14:23:01Z", source: "EDR", severity: "critical", message: "PowerShell spawned from w3wp.exe on prod-web-01" },
  { timestamp: "2026-05-23T14:23:42Z", source: "Firewall", severity: "high", message: "Outbound connection to 185.220.101.34:443" },
  { timestamp: "2026-05-23T14:24:05Z", source: "IAM", severity: "high", message: "User svc-backup assumed admin role" },
  { timestamp: "2026-05-23T14:24:18Z", source: "Network", severity: "medium", message: "2.4GB outbound transfer from prod-db-03" },
  { timestamp: "2026-05-23T14:25:00Z", source: "Process", severity: "critical", message: "Mimikatz execution detected on prod-web-01" },
];

function QueryPage() {
  const [query, setQuery] = useState("event_type:process name:powershell | table timestamp,source,severity,message");
  const [showResults, setShowResults] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (val.endsWith("event_type:")) setSuggestions(["network", "process", "auth", "dns", "iam", "cloud"]);
    else if (val.endsWith("severity:")) setSuggestions(["critical", "high", "medium", "info", "healthy"]);
    else if (val.endsWith("action:")) setSuggestions(["create", "delete", "failed", "success", "assume"]);
    else setSuggestions([]);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2"><Terminal className="h-5 w-5 text-primary" />Query Language</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          {/* Editor */}
          <div className="rounded-lg border border-border bg-surface/60">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Search className="h-4 w-4 text-primary" />
              <span className="text-xs font-mono text-muted-foreground">NEXUS Query Language</span>
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => setShowResults(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"><Play className="h-3 w-3" />Run</button>
                <button className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-surface hover:bg-background text-muted-foreground border border-border transition-colors"><Save className="h-3 w-3" />Save</button>
              </div>
            </div>
            <div className="relative">
              <textarea
                value={query}
                onChange={(e) => handleInput(e.target.value)}
                className="w-full h-24 bg-background text-foreground font-mono text-sm p-4 resize-none outline-none"
                spellCheck={false}
              />
              {suggestions.length > 0 && (
                <div className="absolute left-4 bottom-2 bg-surface border border-border rounded-md shadow-lg py-1 z-10">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => { setQuery(query + s); setSuggestions([]); }} className="block w-full text-left text-xs font-mono px-3 py-1 hover:bg-primary/10 text-foreground">{s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {showResults && (
            <div className="rounded-lg border border-primary/30 bg-surface/60">
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Results</span>
                <div className="flex gap-3 text-[10px] font-mono text-muted-foreground">
                  <span>5 rows</span><span>2.1M scanned</span><span>42ms</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">timestamp</th>
                    <th className="px-4 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">source</th>
                    <th className="px-4 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">severity</th>
                    <th className="px-4 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">message</th>
                  </tr></thead>
                  <tbody>
                    {MOCK_RESULTS.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface transition-colors">
                        <td className="px-4 py-2 font-mono text-muted-foreground">{r.timestamp}</td>
                        <td className="px-4 py-2 font-mono">{r.source}</td>
                        <td className="px-4 py-2"><span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded", r.severity === "critical" ? "bg-critical/10 text-critical" : r.severity === "high" ? "bg-high/10 text-high" : "bg-medium/10 text-medium")}>{r.severity}</span></td>
                        <td className="px-4 py-2">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button key={t.name} onClick={() => { setQuery(t.query); setShowResults(false); }} className="rounded-lg border border-border bg-surface/60 p-3 text-left hover:bg-surface transition-colors">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
                <div className="text-[9px] font-mono text-primary mt-1 truncate">{t.query}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar: Saved + History */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface/60">
            <div className="px-4 py-2 border-b border-border flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Saved Queries</span>
            </div>
            <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
              {SAVED.map((s) => (
                <button key={s.id} onClick={() => { setQuery(s.query); setShowResults(false); }} className="w-full px-4 py-2 text-left hover:bg-surface transition-colors">
                  <div className="text-sm">{s.name}</div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <span>{s.results} results</span>
                    <span>{formatDistanceToNow(s.lastRun, { addSuffix: true })}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface/60">
            <div className="px-4 py-2 border-b border-border flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Recent History</span>
            </div>
            <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
              {HISTORY.map((h, i) => (
                <button key={i} onClick={() => { setQuery(h.query); setShowResults(false); }} className="w-full px-4 py-2 text-left hover:bg-surface transition-colors">
                  <div className="text-[10px] font-mono text-foreground truncate">{h.query}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">{h.results} results • {formatDistanceToNow(h.time, { addSuffix: true })}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Query Help</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div><span className="font-mono text-foreground">event_type:</span> Filter by event type</div>
              <div><span className="font-mono text-foreground">severity:</span> Filter by severity level</div>
              <div><span className="font-mono text-foreground">| stats</span> Aggregate results</div>
              <div><span className="font-mono text-foreground">| table</span> Select columns</div>
              <div><span className="font-mono text-foreground">| sort</span> Order results</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
