import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { useCorrelationStore, type CorrelationNode, type CorrelationEdge } from "@/lib/correlation-store";
import { Network, Search, ZoomIn, ZoomOut, Maximize2, Eye, Shield } from "lucide-react";

export const Route = createFileRoute("/_app/security-graph")({
  head: () => ({ meta: [{ title: "Security Graph — NEXUS" }] }),
  component: SecurityGraphPage,

});

const GRAPH_NODES: CorrelationNode[] = [
  { id: "INC-2847", type: "incident", label: "INC-2847", severity: "critical", metadata: { status: "active" } },
  { id: "ALT-4291", type: "alert", label: "Suspicious PowerShell", severity: "high", metadata: {} },
  { id: "ALT-4302", type: "alert", label: "DNS Beaconing", severity: "high", metadata: {} },
  { id: "ALT-4315", type: "alert", label: "CS C2 Callback", severity: "critical", metadata: {} },
  { id: "ep-prod-web-01", type: "endpoint", label: "prod-web-01", severity: "critical", metadata: { os: "Win 2022" } },
  { id: "ep-prod-db-03", type: "endpoint", label: "prod-db-03", severity: "high", metadata: { os: "RHEL 9" } },
  { id: "CVE-2025-3192", type: "vulnerability", label: "CVE-2025-3192", severity: "critical", metadata: { cvss: "10.0" } },
  { id: "APT-29", type: "actor", label: "APT29", severity: "critical", metadata: { origin: "Russia" } },
  { id: "cloud-rds-snap", type: "cloud_asset", label: "RDS Exposed", severity: "high", metadata: {} },
  { id: "CASE-7001", type: "case", label: "CASE-7001", severity: "critical", metadata: {} },
];

const GRAPH_EDGES: CorrelationEdge[] = [
  { source: "CVE-2025-3192", target: "ep-prod-web-01", relationship: "exploited", strength: 0.95, context: "Log4Shell RCE" },
  { source: "ep-prod-web-01", target: "ALT-4291", relationship: "triggered", strength: 0.9, context: "PowerShell from w3wp" },
  { source: "ep-prod-web-01", target: "ALT-4302", relationship: "triggered", strength: 0.85, context: "DNS C2 beaconing" },
  { source: "ALT-4302", target: "APT-29", relationship: "attributed_to", strength: 0.78, context: "Matches APT29 infra" },
  { source: "ep-prod-web-01", target: "ep-prod-db-03", relationship: "lateral_movement", strength: 0.88, context: "SMB lateral" },
  { source: "ALT-4291", target: "INC-2847", relationship: "escalated_to", strength: 1.0, context: "Escalated" },
  { source: "ALT-4315", target: "INC-2847", relationship: "escalated_to", strength: 1.0, context: "Escalated" },
  { source: "INC-2847", target: "CASE-7001", relationship: "tracked_in", strength: 1.0, context: "Case opened" },
  { source: "ep-prod-db-03", target: "cloud-rds-snap", relationship: "contains", strength: 0.7, context: "Exposed snapshot" },
  { source: "APT-29", target: "CVE-2025-3192", relationship: "uses", strength: 0.82, context: "Known exploit user" },
];

const POSITIONS: Record<string, { x: number; y: number }> = {
  "APT-29": { x: 100, y: 60 },
  "CVE-2025-3192": { x: 300, y: 60 },
  "ep-prod-web-01": { x: 400, y: 180 },
  "ALT-4291": { x: 200, y: 300 },
  "ALT-4302": { x: 550, y: 180 },
  "ALT-4315": { x: 650, y: 300 },
  "INC-2847": { x: 400, y: 380 },
  "ep-prod-db-03": { x: 600, y: 380 },
  "cloud-rds-snap": { x: 750, y: 450 },
  "CASE-7001": { x: 400, y: 480 },
};

const TYPE_STYLES: Record<string, { fill: string; stroke: string; text: string }> = {
  incident: { fill: "#ef444420", stroke: "#ef4444", text: "text-critical" },
  alert: { fill: "#f59e0b20", stroke: "#f59e0b", text: "text-high" },
  endpoint: { fill: "#10b98120", stroke: "#10b981", text: "text-healthy" },
  vulnerability: { fill: "#ef444420", stroke: "#ef4444", text: "text-critical" },
  actor: { fill: "#ef444430", stroke: "#ef4444", text: "text-critical" },
  cloud_asset: { fill: "#3b82f620", stroke: "#3b82f6", text: "text-info" },
  case: { fill: "#f59e0b20", stroke: "#f59e0b", text: "text-high" },
};

const REL_COLORS: Record<string, string> = {
  exploited: "#ef4444", triggered: "#f59e0b", attributed_to: "#3b82f6",
  lateral_movement: "#f59e0b", escalated_to: "#ef4444", tracked_in: "#10b981",
  contains: "#3b82f6", uses: "#ef4444",
};

function SecurityGraphPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const getCorrelations = useCorrelationStore((s) => s.getCorrelations);

  const node = selectedNode ? GRAPH_NODES.find((n) => n.id === selectedNode) : null;
  const correlations = selectedNode ? getCorrelations(selectedNode) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Network className="h-5 w-5 text-primary" />Security Graph</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.min(z + 0.1, 1.5))} className="p-1.5 rounded border border-border hover:bg-surface transition-colors"><ZoomIn className="h-3.5 w-3.5 text-muted-foreground" /></button>
          <span className="text-[9px] font-mono text-muted-foreground w-8 text-center">{(zoom * 100).toFixed(0)}%</span>
          <button onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))} className="p-1.5 rounded border border-border hover:bg-surface transition-colors"><ZoomOut className="h-3.5 w-3.5 text-muted-foreground" /></button>
          <button onClick={() => setZoom(1)} className="p-1.5 rounded border border-border hover:bg-surface transition-colors"><Maximize2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Graph */}
        <div className="rounded-lg border border-border bg-surface/60 overflow-hidden" style={{ minHeight: 560 }}>
          <svg viewBox="0 0 850 540" className="w-full h-full" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" className="fill-muted-foreground" /></marker>
            </defs>

            {GRAPH_EDGES.map((e, i) => {
              const from = POSITIONS[e.source];
              const to = POSITIONS[e.target];
              if (!from || !to) return null;
              return (
                <g key={i}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={REL_COLORS[e.relationship] ?? "#6b7280"} strokeWidth={1 + e.strength} markerEnd="url(#arrow)" opacity={0.6} strokeDasharray={e.relationship === "lateral_movement" ? "6 3" : undefined} />
                  <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6} textAnchor="middle" className="fill-muted-foreground text-[7px]">{e.relationship}</text>
                </g>
              );
            })}

            {GRAPH_NODES.map((n) => {
              const pos = POSITIONS[n.id];
              if (!pos) return null;
              const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.alert;
              const isSelected = selectedNode === n.id;
              return (
                <g key={n.id} onClick={() => setSelectedNode(isSelected ? null : n.id)} className="cursor-pointer">
                  {isSelected && <rect x={pos.x - 58} y={pos.y - 22} width={116} height={44} rx={8} fill="none" stroke="currentColor" className="stroke-primary" strokeWidth={2} strokeDasharray="4 2" />}
                  <rect x={pos.x - 52} y={pos.y - 16} width={104} height={32} rx={6} fill={style.fill} stroke={style.stroke} strokeWidth={1.5} />
                  <text x={pos.x} y={pos.y - 2} textAnchor="middle" className={cn("fill-foreground text-[9px] font-medium")}>{n.label}</text>
                  <text x={pos.x} y={pos.y + 10} textAnchor="middle" className="fill-muted-foreground text-[7px]">{n.type}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {node ? (
            <>
              <div className="rounded-lg border border-border bg-surface/60 p-4 space-y-2">
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">{node.label}</span></div>
                <SeverityBadge severity={node.severity} />
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-mono">{node.type}</span></div>
                  {Object.entries(node.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>
                  ))}
                </div>
              </div>

              {correlations && (
                <div className="rounded-lg border border-border bg-surface/60 p-4 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">AI Correlation</div>
                  <p className="text-xs text-muted-foreground">{correlations.aiSummary}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                    <span className={correlations.riskImpact === "critical" ? "text-critical" : correlations.riskImpact === "high" ? "text-high" : "text-medium"}>
                      Impact: {correlations.riskImpact}
                    </span>
                    <span>Blast radius: {correlations.blastRadius}</span>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border bg-surface/60 p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Relationships</div>
                <div className="space-y-1">
                  {GRAPH_EDGES.filter((e) => e.source === node.id || e.target === node.id).map((e, i) => (
                    <div key={i} className="text-[10px] font-mono flex items-center gap-1.5">
                      <span className="text-muted-foreground">{e.source === node.id ? "→" : "←"}</span>
                      <span style={{ color: REL_COLORS[e.relationship] }}>{e.relationship}</span>
                      <span className="text-muted-foreground">{e.source === node.id ? e.target : e.source}</span>
                      <span className="ml-auto text-muted-foreground">{(e.strength * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-surface/60 p-4 text-xs text-muted-foreground">
              Click a node to explore relationships and AI correlations
            </div>
          )}

          {/* Legend */}
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Entity Types</div>
            <div className="space-y-1">
              {Object.entries(TYPE_STYLES).map(([type, style]) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: style.stroke, backgroundColor: style.fill }} />
                  <span className="capitalize">{type.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
