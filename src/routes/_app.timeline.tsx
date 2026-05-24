import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { Activity, TriangleAlert as AlertTriangle, Bot, Cloud, Shield, Server, FileText, Clock, ListFilter as Filter, Zap, Globe, Monitor, Lock, Bug, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/timeline")({
  head: () => ({ meta: [{ title: "Timeline — NEXUS" }] }),
  component: TimelinePage,

});

type TimelineType = "alert" | "incident" | "deployment" | "ai" | "endpoint" | "policy";

interface TimelineEntry {
  id: string;
  type: TimelineType;
  action: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "info" | "healthy";
  entity: string;
  source: string;
  timestamp: Date;
  correlatedWith?: string[];
}

const TYPE_CONFIG: Record<TimelineType, { icon: typeof Activity; color: string; label: string }> = {
  alert: { icon: AlertTriangle, color: "text-high", label: "Alert" },
  incident: { icon: Shield, color: "text-critical", label: "Incident" },
  deployment: { icon: Cloud, color: "text-info", label: "Deploy" },
  ai: { icon: Bot, color: "text-primary", label: "AI" },
  endpoint: { icon: Monitor, color: "text-healthy", label: "Endpoint" },
  policy: { icon: FileText, color: "text-medium", label: "Policy" },
};

const ENTRIES: TimelineEntry[] = [
  { id: "tl-1", type: "alert", action: "triggered", title: "Suspicious PowerShell Execution", description: "PowerShell spawned from w3wp.exe on prod-web-01", severity: "high", entity: "ALT-4291", source: "EDR", timestamp: new Date(Date.now() - 120000), correlatedWith: ["INC-2847", "ep-prod-web-01"] },
  { id: "tl-2", type: "alert", action: "triggered", title: "Cobalt Strike C2 Callback", description: "Outbound connection to known C2 infrastructure 185.220.101.34", severity: "critical", entity: "ALT-4315", source: "Firewall", timestamp: new Date(Date.now() - 180000), correlatedWith: ["INC-2847", "APT-29"] },
  { id: "tl-3", type: "incident", action: "escalated", title: "INC-2847 escalated to P1", description: "Severity escalated from high to critical — confirmed APT activity", severity: "critical", entity: "INC-2847", source: "SOC", timestamp: new Date(Date.now() - 300000), correlatedWith: ["ALT-4291", "ALT-4315"] },
  { id: "tl-4", type: "ai", action: "generated", title: "AI Root Cause Analysis Complete", description: "High-confidence correlation: Log4Shell exploitation leading to lateral movement", severity: "high", entity: "AI-RCA-001", source: "NEXUS AI", timestamp: new Date(Date.now() - 420000), correlatedWith: ["INC-2847"] },
  { id: "tl-5", type: "endpoint", action: "isolated", title: "prod-web-01 network isolated", description: "Endpoint quarantined by SOC analyst Sarah Chen", severity: "high", entity: "ep-prod-web-01", source: "EDR", timestamp: new Date(Date.now() - 540000) },
  { id: "tl-6", type: "deployment", action: "completed", title: "Detection rules v2.14.3 deployed", description: "12 new Sigma rules for Cobalt Strike and Living-off-the-Land binaries", severity: "info", entity: "DEPLOY-892", source: "CI/CD", timestamp: new Date(Date.now() - 600000) },
  { id: "tl-7", type: "policy", action: "violated", title: "IAM policy violation: wildcard permissions", description: "Role 'lambda-exec' has s3:* on production bucket", severity: "high", entity: "POL-IAM-042", source: "CSPM", timestamp: new Date(Date.now() - 720000) },
  { id: "tl-8", type: "alert", action: "suppressed", title: "Anomalous DNS (false positive)", description: "Health check endpoint flagged — suppression rule applied", severity: "info", entity: "ALT-4290", source: "Network", timestamp: new Date(Date.now() - 840000) },
  { id: "tl-9", type: "incident", action: "opened", title: "INC-2848 Data exfiltration suspected", description: "Large outbound transfer from prod-db-03 to unknown endpoint", severity: "critical", entity: "INC-2848", source: "DLP", timestamp: new Date(Date.now() - 960000) },
  { id: "tl-10", type: "ai", action: "detected", title: "Anomaly cluster: After-hours access pattern", description: "3 users accessing sensitive resources outside business hours", severity: "medium", entity: "AI-ANOM-017", source: "NEXUS AI", timestamp: new Date(Date.now() - 1080000) },
  { id: "tl-11", type: "endpoint", action: "malware", title: "Malware detected on dev-api-02", description: "Cobalt Strike beacon DLL found in temp directory", severity: "critical", entity: "ep-dev-api-02", source: "EDR", timestamp: new Date(Date.now() - 1200000) },
  { id: "tl-12", type: "deployment", action: "rolled_back", title: "Agent v4.2.1 rollback", description: "Memory leak detected — rolled back to v4.2.0 on 23 endpoints", severity: "high", entity: "DEPLOY-891", source: "CI/CD", timestamp: new Date(Date.now() - 1440000) },
  { id: "tl-13", type: "policy", action: "updated", title: "Retention policy updated: 90-day event storage", description: "Changed from 30-day to 90-day retention for compliance", severity: "info", entity: "POL-RET-008", source: "Admin", timestamp: new Date(Date.now() - 1800000) },
  { id: "tl-14", type: "alert", action: "acknowledged", title: "Brute force attempt blocked", description: "12 failed logins from 103.21.44.17 — auto-blocked", severity: "medium", entity: "ALT-4280", source: "IAM", timestamp: new Date(Date.now() - 2160000) },
  { id: "tl-15", type: "ai", action: "generated", title: "AI Investigation Summary for INV-0042", description: "Insider threat indicators — USB insertion + after-hours VPN + privilege escalation", severity: "high", entity: "AI-INV-042", source: "NEXUS AI", timestamp: new Date(Date.now() - 2520000) },
  { id: "tl-16", type: "incident", action: "closed", title: "INC-2845 Resolved — false positive", description: "Determined to be authorized pen test by security team", severity: "healthy", entity: "INC-2845", source: "SOC", timestamp: new Date(Date.now() - 2880000) },
  { id: "tl-17", type: "endpoint", action: "checkin_failed", title: "prod-cache-02 agent offline", description: "Last check-in 45 minutes ago — possible network issue", severity: "medium", entity: "ep-prod-cache-02", source: "Agent", timestamp: new Date(Date.now() - 3240000) },
  { id: "tl-18", type: "alert", action: "triggered", title: "Exposed S3 bucket detected", description: "Bucket 'acme-logs-prod' has public read access", severity: "high", entity: "ALT-4320", source: "CSPM", timestamp: new Date(Date.now() - 3600000) },
  { id: "tl-19", type: "deployment", action: "started", title: "Endpoint agent v4.3.0 rollout", description: "Rolling update across 2,847 production endpoints", severity: "info", entity: "DEPLOY-893", source: "CI/CD", timestamp: new Date(Date.now() - 3960000) },
  { id: "tl-20", type: "policy", action: "created", title: "New detection rule: DNS tunneling", description: "Sigma rule for high-volume DNS TXT queries to suspicious domains", severity: "info", entity: "POL-DET-156", source: "Detection Eng", timestamp: new Date(Date.now() - 4320000) },
  { id: "tl-21", type: "ai", action: "detected", title: "Anomaly: Unusual data transfer volume", description: "prod-db-03 egress 2.4GB in 15 minutes — baseline is 50MB", severity: "high", entity: "AI-ANOM-018", source: "NEXUS AI", timestamp: new Date(Date.now() - 4680000), correlatedWith: ["INC-2848"] },
  { id: "tl-22", type: "alert", action: "escalated", title: "Privilege escalation on staging-app-01", description: "User escalated from analyst to admin role — unauthorized", severity: "high", entity: "ALT-4325", source: "IAM", timestamp: new Date(Date.now() - 5040000) },
  { id: "tl-23", type: "incident", action: "updated", title: "INC-2846 status changed to monitoring", description: "Containment verified — monitoring for reoccurrence", severity: "medium", entity: "INC-2846", source: "SOC", timestamp: new Date(Date.now() - 5400000) },
  { id: "tl-24", type: "endpoint", action: "quarantined", title: "dev-workstation-05 quarantined", description: "Ransomware payload detected in email attachment", severity: "critical", entity: "ep-dev-ws-05", source: "EDR", timestamp: new Date(Date.now() - 5760000) },
  { id: "tl-25", type: "deployment", action: "completed", title: "WAF rules update v3.8.1", description: "Added OWASP Top 10 2025 protection rules", severity: "healthy", entity: "DEPLOY-890", source: "CI/CD", timestamp: new Date(Date.now() - 6120000) },
];

const TYPE_FILTERS: { key: TimelineType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "alert", label: "Alerts" },
  { key: "incident", label: "Incidents" },
  { key: "deployment", label: "Deployments" },
  { key: "ai", label: "AI Events" },
  { key: "endpoint", label: "Endpoints" },
  { key: "policy", label: "Policies" },
];

function timeGroup(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 86400000) return "Today";
  if (diff < 172800000) return "Yesterday";
  if (diff < 604800000) return "This Week";
  return "Earlier";
}

function TimelinePage() {
  const [typeFilter, setTypeFilter] = useState<TimelineType | "all">("all");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = ENTRIES.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (sevFilter !== "all" && e.severity !== sevFilter) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, TimelineEntry[]>>((acc, e) => {
    const g = timeGroup(e.timestamp);
    (acc[g] ??= []).push(e);
    return acc;
  }, {});

  const counts = ENTRIES.reduce<Record<TimelineType, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {} as Record<TimelineType, number>);

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      {/* Sidebar filters */}
      <aside className="w-full lg:w-56 shrink-0 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          Timeline Filters
        </div>
        <div className="space-y-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 text-xs rounded transition-colors",
                typeFilter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-surface",
              )}
            >
              <span className="flex items-center gap-2">
                {f.key !== "all" && React.createElement(TYPE_CONFIG[f.key].icon, { className: "h-3 w-3" })}
                {f.label}
              </span>
              {f.key !== "all" && counts[f.key] && (
                <span className="font-mono text-muted-foreground">{counts[f.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="space-y-1 pt-2 border-t border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 pb-1">Severity</div>
          {["all", "critical", "high", "medium", "info", "healthy"].map((s) => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={cn(
                "w-full px-3 py-1 text-xs rounded transition-colors text-left",
                sevFilter === s ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All severities" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="pt-2 border-t border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 pb-2">Live</div>
          <div className="flex items-center gap-2 px-3">
            <span className="h-2 w-2 rounded-full bg-healthy animate-pulse" />
            <span className="text-xs text-muted-foreground">25 events streaming</span>
          </div>
        </div>
      </aside>

      {/* Timeline */}
      <main className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Global Timeline</h1>
            <p className="text-xs text-muted-foreground mt-1">Unified operational intelligence across all modules</p>
          </div>
          <div className="text-xs font-mono text-muted-foreground">{filtered.length} events</div>
        </div>

        {Object.entries(grouped).map(([group, entries]) => (
          <div key={group}>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Filter className="h-3 w-3" />{group}
            </div>
            <div className="space-y-0.5">
              {entries.map((entry, i) => {
                const cfg = TYPE_CONFIG[entry.type];
                const Icon = cfg.icon;
                const isExpanded = expanded.has(entry.id);
                return (
                  <div key={entry.id} className="relative">
                    {/* Vertical line */}
                    {i < entries.length - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                    )}
                    <button
                      onClick={() => toggle(entry.id)}
                      className={cn(
                        "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                        "hover:bg-surface/60",
                        entry.severity === "critical" && "border-l-2 border-l-critical",
                      )}
                    >
                      {/* Type icon */}
                      <span className={cn("mt-0.5", cfg.color)}>
                        <Icon className="h-4 w-4" />
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
                          <span className="text-[9px] font-mono text-muted-foreground">•</span>
                          <span className="text-[9px] font-mono text-muted-foreground">{entry.action}</span>
                          <SeverityBadge severity={entry.severity} />
                          {entry.correlatedWith && (
                            <span className="flex items-center gap-0.5 text-[8px] font-mono text-primary">
                              <Zap className="h-2.5 w-2.5" />{entry.correlatedWith.length} linked
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium mt-0.5 truncate">{entry.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground">{entry.entity}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(entry.timestamp, { addSuffix: true })}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">via {entry.source}</span>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 pl-2 border-l border-border space-y-1">
                            <p className="text-xs text-muted-foreground">{entry.description}</p>
                            {entry.correlatedWith && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Zap className="h-3 w-3 text-primary" />
                                {entry.correlatedWith.map((c) => (
                                  <span key={c} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <span className="text-muted-foreground mt-1">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

