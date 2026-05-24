import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { MetricCard } from "@/components/metric-card";
import { makeMetricSeries } from "@/lib/mock/generators";
import { formatDistanceToNow } from "date-fns";
import { Crosshair, Search, Target, TrendingUp, Zap, ListFilter as Filter, Clock, Globe, Bug, Play, Save, RotateCcw, ChevronRight, TriangleAlert as AlertTriangle, ChartBar as BarChart3, ArrowRightLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/hunt")({
  head: () => ({ meta: [{ title: "Threat Hunting — NEXUS" }] }),
  component: HuntPage,

});

interface HuntQuery {
  id: string;
  name: string;
  description: string;
  query: string;
  frequency: string;
  lastRun: Date;
  hits: number;
  severity: "critical" | "high" | "medium" | "info";
}

interface Anomaly {
  id: string;
  type: string;
  description: string;
  baseline: number;
  observed: number;
  deviation: number;
  assets: string[];
  severity: "critical" | "high" | "medium";
  confidence: number;
}

interface Pivot {
  id: string;
  from: string;
  to: string;
  description: string;
  entityCount: number;
}

const QUERIES: HuntQuery[] = [
  { id: "hq-1", name: "Cobalt Strike C2 Beaconing", description: "Detect periodic DNS callbacks to known C2 infrastructure", query: "event_type:network DNS WHERE frequency > 5/min AND domain.age < 7d", frequency: "1h", lastRun: new Date(Date.now() - 1800000), hits: 3, severity: "critical" },
  { id: "hq-2", name: "Lateral Movement via SMB", description: "SMB authentication from non-standard sources", query: "event_type:auth protocol:SMB WHERE src != $internal_subnets AND action:success", frequency: "15m", lastRun: new Date(Date.now() - 600000), hits: 7, severity: "high" },
  { id: "hq-3", name: "Living-off-the-Land Binaries", description: "LOLBAS execution from suspicious parent processes", query: "event_type:process WHERE name IN (certutil,mshta,mavinject) AND parent != explorer.exe", frequency: "5m", lastRun: new Date(Date.now() - 300000), hits: 1, severity: "high" },
  { id: "hq-4", name: "After-Hours Data Exfiltration", description: "Large outbound transfers outside business hours", query: "event_type:network bytes_out > 100MB WHERE timestamp.hour NOT IN (8..18)", frequency: "30m", lastRun: new Date(Date.now() - 900000), hits: 2, severity: "medium" },
  { id: "hq-5", name: "Privilege Escalation Attempts", description: "Users escalating to admin roles outside change windows", query: "event_type:iam action:role_assume WHERE role:admin AND change_window:false", frequency: "10m", lastRun: new Date(Date.now() - 1200000), hits: 0, severity: "high" },
  { id: "hq-6", name: "Ransomware Precursor Activity", description: "vssadmin delete, bcdedit, wbadmin disable patterns", query: "event_type:process WHERE cmdline CONTAINS (vssadmin delete, bcdedit /restore, wbadmin disable)", frequency: "5m", lastRun: new Date(Date.now() - 420000), hits: 0, severity: "critical" },
  { id: "hq-7", name: "Shadow IT Cloud Resources", description: "New cloud resources created outside IaC pipelines", query: "event_type:cloud action:create WHERE source != terraform AND source != pulumi", frequency: "1h", lastRun: new Date(Date.now() - 2400000), hits: 5, severity: "medium" },
  { id: "hq-8", name: "DNS Tunneling Detection", description: "High-volume DNS TXT queries with large response sizes", query: "event_type:dns type:TXT WHERE response_size > 200 AND count > 50/min", frequency: "15m", lastRun: new Date(Date.now() - 1500000), hits: 1, severity: "high" },
];

const ANOMALIES: Anomaly[] = [
  { id: "an-1", type: "Network Volume", description: "Unusual egress from prod-db-03", baseline: 50, observed: 2400, deviation: 4800, assets: ["prod-db-03"], severity: "critical", confidence: 0.94 },
  { id: "an-2", type: "Auth Pattern", description: "3 users accessing resources after hours", baseline: 0, observed: 3, deviation: 100, assets: ["u-chen", "u-miller", "u-rivera"], severity: "high", confidence: 0.82 },
  { id: "an-3", type: "Process Behavior", description: "PowerShell from web worker process", baseline: 0, observed: 1, deviation: 100, assets: ["prod-web-01"], severity: "critical", confidence: 0.97 },
  { id: "an-4", type: "IAM Changes", description: "Rapid role escalation sequence", baseline: 1, observed: 8, deviation: 700, assets: ["iam-role-lambda"], severity: "high", confidence: 0.76 },
  { id: "an-5", type: "DNS Pattern", description: "Periodic beaconing to new domain", baseline: 2, observed: 45, deviation: 2150, assets: ["prod-web-01", "dns-resolver"], severity: "high", confidence: 0.89 },
  { id: "an-6", type: "File Activity", description: "Mass file encryption on dev-workstation", baseline: 0, observed: 1, deviation: 100, assets: ["dev-ws-05"], severity: "critical", confidence: 0.99 },
];

const PIVOTS: Pivot[] = [
  { id: "pv-1", from: "IP 185.220.101.34", to: "Related Endpoints", description: "Find all endpoints communicating with this C2 IP", entityCount: 3 },
  { id: "pv-2", from: "Hash a3f2b1c...", to: "Related Alerts", description: "Find all alerts involving this Cobalt Strike payload", entityCount: 7 },
  { id: "pv-3", from: "User svc-backup", to: "Resource Access", description: "Trace all resources accessed by this service account", entityCount: 12 },
  { id: "pv-4", from: "CVE-2025-3192", to: "Affected Endpoints", description: "Find all endpoints running vulnerable Log4j version", entityCount: 3 },
  { id: "pv-5", from: "Domain c2.nexus-cdn.net", to: "DNS History", description: "Query all historical DNS lookups for this domain", entityCount: 45 },
];

const IOC_RESULTS = [
  { type: "IP", value: "185.220.101.34", context: "Known Cobalt Strike C2", severity: "critical" as const, firstSeen: new Date(Date.now() - 86400000), count: 47 },
  { type: "Hash", value: "a3f2b1c8d4e5f6a7", context: "CS Beacon DLL", severity: "critical" as const, firstSeen: new Date(Date.now() - 172800000), count: 3 },
  { type: "Domain", value: "c2.nexus-cdn.net", context: "Recently registered, DNS beacon", severity: "high" as const, firstSeen: new Date(Date.now() - 43200000), count: 156 },
  { type: "Email", value: "hr-update@acme-corp.com", context: "Phishing sender", severity: "high" as const, firstSeen: new Date(Date.now() - 259200000), count: 12 },
];

function HuntPage() {
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [queryText, setQueryText] = useState(QUERIES[0].query);
  const [iocSearch, setIocSearch] = useState("");
  const [showResults, setShowResults] = useState(false);

  const activeQuery = QUERIES.find((q) => q.id === selectedQuery);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Crosshair className="h-5 w-5 text-primary" />Threat Hunting</h1>
          <p className="text-xs text-muted-foreground mt-1">Proactive threat detection and IOC exploration</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-healthy animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">8 active queries</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Active Hunts" value="8" icon={Crosshair} tone="default" series={makeMetricSeries(8, 40)} />
        <MetricCard label="Hits/24h" value="19" delta={{ v: "+4", up: true }} icon={Zap} tone="high" series={makeMetricSeries(19, 40)} />
        <MetricCard label="Anomalies" value="6" icon={AlertTriangle} tone="critical" series={makeMetricSeries(6, 40)} />
        <MetricCard label="IOCs Tracked" value="347" icon={Bug} tone="default" series={makeMetricSeries(347, 40)} />
        <MetricCard label="Coverage" value="94%" icon={Target} tone="healthy" series={makeMetricSeries(94, 40)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        {/* Query Editor */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface/60">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Search className="h-4 w-4 text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Query Editor</span>
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => setShowResults(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                  <Play className="h-3 w-3" />Run
                </button>
                <button className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-surface hover:bg-surface-2 text-muted-foreground transition-colors">
                  <Save className="h-3 w-3" />Save
                </button>
              </div>
            </div>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="w-full h-32 bg-background text-foreground font-mono text-sm p-4 resize-none outline-none"
              placeholder="event_type:network WHERE src_ip = '...' AND bytes > 100MB"
              spellCheck={false}
            />
          </div>

          {/* Saved Queries */}
          <div className="rounded-lg border border-border bg-surface/60">
            <div className="px-4 py-2 border-b border-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Saved Hunting Queries</span>
            </div>
            <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
              {QUERIES.map((q) => (
                <button
                  key={q.id}
                  onClick={() => { setSelectedQuery(q.id); setQueryText(q.query); }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left hover:bg-surface transition-colors",
                    selectedQuery === q.id && "bg-primary/5 border-l-2 border-l-primary",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={q.severity} />
                    <span className="text-sm font-medium">{q.name}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">{q.frequency}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-muted-foreground">
                    <span>{q.hits} hits</span>
                    <span>Last: {formatDistanceToNow(q.lastRun, { addSuffix: true })}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* IOC Search */}
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">IOC Hunt</span>
            </div>
            <div className="flex gap-2">
              <input
                value={iocSearch}
                onChange={(e) => setIocSearch(e.target.value)}
                placeholder="Search IP, domain, hash, email..."
                className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm font-mono outline-none focus:border-primary"
              />
              <button className="px-3 py-1.5 bg-primary/20 text-primary rounded text-xs hover:bg-primary/30 transition-colors">
                <Target className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 space-y-1.5">
              {IOC_RESULTS.map((ioc) => (
                <div key={ioc.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface transition-colors">
                  <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border", ioc.type === "IP" ? "text-critical border-critical/30 bg-critical/10" : ioc.type === "Hash" ? "text-high border-high/30 bg-high/10" : ioc.type === "Domain" ? "text-info border-info/30 bg-info/10" : "text-medium border-medium/30 bg-medium/10")}>
                    {ioc.type}
                  </span>
                  <span className="text-xs font-mono">{ioc.value}</span>
                  <span className="text-[10px] text-muted-foreground">{ioc.context}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">{ioc.count} hits</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results + Pivots + Anomalies */}
        <div className="space-y-4">
          {/* Query Results */}
          {showResults && (
            <div className="rounded-lg border border-primary/30 bg-surface/60">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Query Results</span>
                <span className="ml-auto text-[10px] font-mono text-primary">3 matches</span>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { time: "14:23:01", src: "prod-web-01", dst: "185.220.101.34", bytes: "2.4MB", proto: "DNS" },
                  { time: "14:23:31", src: "prod-web-01", dst: "185.220.101.34", bytes: "2.1MB", proto: "DNS" },
                  { time: "14:24:01", src: "prod-web-01", dst: "185.220.101.34", bytes: "2.3MB", proto: "DNS" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded bg-background text-xs font-mono">
                    <span className="text-muted-foreground">{r.time}</span>
                    <span>{r.src}</span>
                    <ArrowRightLeft className="h-3 w-3 text-primary" />
                    <span className="text-critical">{r.dst}</span>
                    <span className="ml-auto text-muted-foreground">{r.bytes} {r.proto}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomalies */}
          <div className="rounded-lg border border-border bg-surface/60">
            <div className="px-4 py-2 border-b border-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Anomaly Detection</span>
            </div>
            <div className="divide-y divide-border max-h-[240px] overflow-y-auto">
              {ANOMALIES.map((a) => (
                <div key={a.id} className="px-4 py-2.5 hover:bg-surface transition-colors">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-sm font-medium">{a.type}</span>
                    <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                      {(a.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] font-mono">
                    <span className="text-muted-foreground">Baseline: {a.baseline}</span>
                    <span className="text-critical">Observed: {a.observed}</span>
                    <span className="text-high">+{a.deviation}% deviation</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pivots */}
          <div className="rounded-lg border border-border bg-surface/60">
            <div className="px-4 py-2 border-b border-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Attack Pivots</span>
            </div>
            <div className="divide-y divide-border">
              {PIVOTS.map((p) => (
                <button key={p.id} className="w-full px-4 py-2.5 text-left hover:bg-surface transition-colors">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-foreground">{p.from}</span>
                    <ChevronRight className="h-3 w-3 text-primary" />
                    <span className="font-mono text-primary">{p.to}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <span>{p.description}</span>
                    <span className="ml-auto font-mono">{p.entityCount} entities</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
