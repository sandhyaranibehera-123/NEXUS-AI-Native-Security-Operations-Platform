import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/metric-card";
import { makeMetricSeries } from "@/lib/mock/generators";
import { SeverityBadge } from "@/components/severity-badge";
import { Server, Activity, Shield, TriangleAlert as AlertTriangle, Eye, Layers, Wifi } from "lucide-react";

export const Route = createFileRoute("/_app/digital-twin")({
  head: () => ({ meta: [{ title: "Digital Twin — NEXUS" }] }),
  component: DigitalTwinPage,

});

const NODES = [
  { id: "n1", label: "Load Balancer", type: "lb", x: 400, y: 40, health: 99.9, severity: "healthy" as const },
  { id: "n2", label: "Web Server 01", type: "server", x: 250, y: 140, health: 23, severity: "critical" as const },
  { id: "n3", label: "Web Server 02", type: "server", x: 550, y: 140, health: 98.5, severity: "healthy" as const },
  { id: "n4", label: "API Gateway", type: "gateway", x: 400, y: 240, health: 97.2, severity: "healthy" as const },
  { id: "n5", label: "Auth Service", type: "service", x: 200, y: 340, health: 99.1, severity: "healthy" as const },
  { id: "n6", label: "Database Primary", type: "db", x: 400, y: 340, health: 67, severity: "high" as const },
  { id: "n7", label: "Cache Cluster", type: "cache", x: 600, y: 340, health: 94.5, severity: "info" as const },
  { id: "n8", label: "ML Pipeline", type: "service", x: 300, y: 440, health: 88, severity: "medium" as const },
  { id: "n9", label: "Object Storage", type: "storage", x: 500, y: 440, health: 99.7, severity: "healthy" as const },
];

const EDGES = [
  { from: "n1", to: "n2" }, { from: "n1", to: "n3" }, { from: "n2", to: "n4" }, { from: "n3", to: "n4" },
  { from: "n4", to: "n5" }, { from: "n4", to: "n6" }, { from: "n4", to: "n7" },
  { from: "n6", to: "n8" }, { from: "n7", to: "n8" }, { from: "n6", to: "n9" },
];

const TYPE_COLORS: Record<string, string> = {
  lb: "#10b981", server: "#ef4444", gateway: "#3b82f6", service: "#f59e0b",
  db: "#8b5cf6", cache: "#06b6d4", storage: "#84cc16",
};

const OVERLAYS = ["health", "security", "traffic", "none"] as const;

function DigitalTwinPage() {
  const [overlay, setOverlay] = useState<typeof OVERLAYS[number]>("health");
  const [selected, setSelected] = useState<string | null>(null);

  const selectedNode = NODES.find((n) => n.id === selected);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Digital Twin</h1>
        <div className="flex items-center gap-1">
          {OVERLAYS.map((o) => (
            <button key={o} onClick={() => setOverlay(o)} className={cn("text-[9px] font-mono px-2 py-1 rounded border transition-colors", overlay === o ? "bg-primary/20 text-primary border-primary/30" : "text-muted-foreground border-border hover:text-foreground")}>
              {o}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Services" value="9" icon={Server} tone="default" series={makeMetricSeries(9, 40)} />
        <MetricCard label="Healthy" value="6" icon={Activity} tone="healthy" series={makeMetricSeries(6, 40)} />
        <MetricCard label="Degraded" value="2" icon={AlertTriangle} tone="high" series={makeMetricSeries(2, 40)} />
        <MetricCard label="Critical" value="1" icon={Shield} tone="critical" series={makeMetricSeries(1, 40)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Topology SVG */}
        <div className="rounded-lg border border-border bg-surface/60 relative overflow-hidden" style={{ minHeight: 520 }}>
          <svg viewBox="0 0 800 520" className="w-full h-full">
            {EDGES.map((e, i) => {
              const from = NODES.find((n) => n.id === e.from)!;
              const to = NODES.find((n) => n.id === e.to)!;
              return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" className="text-border" strokeWidth={1.5} />;
            })}
            {NODES.map((n) => (
              <g key={n.id} onClick={() => setSelected(n.id)} className="cursor-pointer">
                {n.severity === "critical" && <circle cx={n.x} cy={n.y} r={32} fill="none" stroke="currentColor" className="text-critical animate-pulse" strokeWidth={1.5} strokeDasharray="4 4" />}
                <rect x={n.x - 48} y={n.y - 18} width={96} height={36} rx={6} fill={TYPE_COLORS[n.type] + "20"} stroke={TYPE_COLORS[n.type]} strokeWidth={1.5} />
                <text x={n.x} y={n.y - 4} textAnchor="middle" className="fill-foreground text-[10px] font-medium">{n.label}</text>
                <text x={n.x} y={n.y + 10} textAnchor="middle" className="fill-muted-foreground text-[8px] font-mono">{n.health}%</text>
              </g>
            ))}
          </svg>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {selectedNode ? (
            <div className="rounded-lg border border-border bg-surface/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" style={{ color: TYPE_COLORS[selectedNode.type] }} />
                <span className="text-sm font-semibold">{selectedNode.label}</span>
              </div>
              <SeverityBadge severity={selectedNode.severity} />
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Health</span><span className="font-mono">{selectedNode.health}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-mono">{selectedNode.type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Connections</span><span className="font-mono">{EDGES.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).length}</span></div>
              </div>
              {selectedNode.severity === "critical" && (
                <div className="flex items-center gap-1.5 text-[10px] text-critical bg-critical/10 px-2 py-1.5 rounded border border-critical/30">
                  <AlertTriangle className="h-3 w-3" />Active compromise detected
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface/60 p-4 text-xs text-muted-foreground">
              Click a node to view details
            </div>
          )}

          {/* Security overlay legend */}
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Service Types</div>
            <div className="space-y-1">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
