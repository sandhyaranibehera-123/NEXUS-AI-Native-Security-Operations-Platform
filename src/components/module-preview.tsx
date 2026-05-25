import { MetricCard } from "@/components/metric-card";
import { SeverityBadge } from "@/components/severity-badge";
import { WorkspaceContext } from "@/components/workspace-context";
import { cn } from "@/lib/utils";
import { makeMetricSeries } from "@/lib/mock/generators";
import type { LucideIcon } from "lucide-react";
import type { Severity } from "@/lib/mock/types";

export interface ModuleKPI {
  label: string;
  value: string | number;
  delta?: { v: string; up: boolean };
  icon: LucideIcon;
  tone?: "default" | "critical" | "high" | "healthy" | "info";
  series?: number;
}

export interface ModuleRow {
  cells: (string | number)[];
  severity?: Severity;
}

export interface ModulePreviewProps {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  kpis: ModuleKPI[];
  tableTitle: string;
  columns: string[];
  rows: ModuleRow[];
  rightPanel?: {
    title: string;
    items: { label: string; value: string; tone?: "critical" | "high" | "healthy" | "info" }[];
  };
}

export function ModulePreview(p: ModulePreviewProps) {
  const Icon = p.icon;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-border bg-surface/40 px-6 py-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/30">
              <Icon className="size-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                {p.eyebrow}
              </div>
              <h1 className="text-xl font-semibold tracking-tight">{p.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{p.description}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Preview · Mock Data
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <WorkspaceContext />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {p.kpis.map((k) => (
            <MetricCard
              key={k.label}
              label={k.label}
              value={k.value}
              delta={k.delta}
              icon={k.icon}
              tone={k.tone}
              series={k.series ? makeMetricSeries(32, k.series, Math.max(2, Math.round(k.series * 0.15))) : undefined}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-lg border border-border bg-surface/40">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {p.tableTitle}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">{p.rows.length} rows</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {p.columns.map((c) => (
                      <th key={c} className="px-4 py-2 font-normal">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.rows.map((r, i) => (
                    <tr key={i} className="border-t border-border/60 hover:bg-surface">
                      {r.cells.map((cell, j) => (
                        <td key={j} className="px-4 py-2 tabular-nums">
                          {j === 0 && r.severity ? (
                            <div className="flex items-center gap-2">
                              <SeverityBadge severity={r.severity} />
                              <span>{cell}</span>
                            </div>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {p.rightPanel && (
            <div className="rounded-lg border border-border bg-surface/40">
              <div className="border-b border-border px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {p.rightPanel.title}
              </div>
              <ul className="divide-y divide-border/60">
                {p.rightPanel.items.map((it) => (
                  <li key={it.label} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                    <span className="text-muted-foreground">{it.label}</span>
                    <span className={cn(
                      "tabular-nums font-medium",
                      it.tone === "critical" && "text-critical",
                      it.tone === "high" && "text-high",
                      it.tone === "healthy" && "text-healthy",
                      it.tone === "info" && "text-info",
                    )}>
                      {it.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
