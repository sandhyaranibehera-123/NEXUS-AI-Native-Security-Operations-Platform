import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/mock/types";

const STYLES: Record<Severity, string> = {
  critical: "bg-critical/15 text-critical border-critical/40",
  high: "bg-high/15 text-high border-high/40",
  medium: "bg-medium/15 text-medium border-medium/40",
  info: "bg-info/15 text-info border-info/40",
  healthy: "bg-healthy/15 text-healthy border-healthy/40",
};

const LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  info: "Info",
  healthy: "Healthy",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider font-mono",
        STYLES[severity],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current pulse-dot" />
      {LABEL[severity]}
    </span>
  );
}

export function SeverityDot({ severity, className }: { severity: Severity; className?: string }) {
  const color: Record<Severity, string> = {
    critical: "bg-critical",
    high: "bg-high",
    medium: "bg-medium",
    info: "bg-info",
    healthy: "bg-healthy",
  };
  return <span className={cn("inline-block size-2 rounded-full", color[severity], className)} />;
}
