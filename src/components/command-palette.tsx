import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, TriangleAlert as AlertTriangle, Bell, Bug, CaseSensitive, FileSearch, FingerprintPattern as Fingerprint, GitBranch, Globe, ListChecks, Plug, Search, Settings, Sparkles, User, Hash, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { visibleFeaturesForRole } from "@/lib/workspace-config";
import { useSearch } from "@/lib/api-hooks";

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

/* PAGES are derived per-role from workspace-config — see usePages() below. */

const ACTIONS = [
  { label: "Open AI Copilot", icon: Sparkles, hint: "Soon" },
  { label: "Acknowledge all alerts", icon: AlertTriangle, hint: "Bulk action" },
  { label: "Open Attack Graph", icon: GitBranch, hint: "Soon" },
  { label: "View Compliance posture", icon: ListChecks, hint: "Soon" },
  { label: "Manage integrations", icon: Plug, hint: "Soon" },
  { label: "Identity risk review", icon: Fingerprint, hint: "Soon" },
  { label: "Settings", icon: Settings, hint: "Workspace settings" },
  { label: "Open notifications", icon: Bell, hint: "View alerts" },
  { label: "Start investigation", icon: Search, hint: "New case" },
  { label: "Export current view", icon: Activity, hint: "CSV / PDF" },
  { label: "Run saved query", icon: FileSearch, hint: "Replay search" },
];

const RECENT = [
  { to: "/incidents/INC-2847", label: "INC-2847 Lateral movement", type: "Incident" },
  { to: "/events?src=10.0.4.22", label: "Events from 10.0.4.22", type: "Event" },
  { to: "/vulnerabilities/CVE-2025-3192", label: "CVE-2025-3192", type: "Vulnerability" },
  { to: "/endpoints/host-091", label: "host-091", type: "Endpoint" },
];

const SAVED_QUERIES = [
  { label: "Critical events last 24h", filter: "severity:critical source:SIEM type:event" },
  { label: "Open incidents by tier-1", filter: "status:open type:incident severity:high" },
  { label: "Unpatched CVEs score 9+", filter: "type:vulnerability severity:critical status:open" },
  { label: "Compromised endpoints", filter: "type:endpoint status:compromised" },
  { label: "APT29 activity", filter: "source:TI type:actor actor:APT29" },
];

type EntityKind = "Event" | "Incident" | "Endpoint" | "Vulnerability" | "Actor";

const ENTITY_BADGE: Record<EntityKind, { bg: string; text: string }> = {
  Event:          { bg: "bg-sky-900/50",  text: "text-sky-300" },
  Incident:       { bg: "bg-rose-900/50",  text: "text-rose-300" },
  Endpoint:       { bg: "bg-teal-900/50",  text: "text-teal-300" },
  Vulnerability:  { bg: "bg-amber-900/50",  text: "text-amber-300" },
  Actor:          { bg: "bg-red-900/50",    text: "text-red-300" },
};

const MOCK_SEARCH: { kind: EntityKind; label: string; detail: string }[] = [
  { kind: "Event",         label: "Brute-force attempt on SSH",       detail: "10.0.4.22 -> 10.0.1.5  |  severity: high" },
  { kind: "Event",         label: "Suspicious PowerShell execution",  detail: "host-091  |  severity: medium" },
  { kind: "Event",         label: "DNS tunneling detected",          detail: "src: 192.168.1.100  |  severity: critical" },
  { kind: "Incident",      label: "INC-2847 Lateral movement",       detail: "severity: critical  |  status: open" },
  { kind: "Incident",      label: "INC-2901 Data exfiltration",      detail: "severity: high  |  status: investigating" },
  { kind: "Incident",      label: "INC-2855 Phishing campaign",      detail: "severity: medium  |  status: contained" },
  { kind: "Endpoint",      label: "host-091 (Windows Server)",       detail: "status: compromised  |  last seen: 2m ago" },
  { kind: "Endpoint",      label: "db-prod-03 (Linux)",              detail: "status: clean  |  last seen: 5m ago" },
  { kind: "Endpoint",      label: "web-gateway-02",                  detail: "status: at-risk  |  last seen: 12m ago" },
  { kind: "Vulnerability", label: "CVE-2025-3192 Log4Shell variant", detail: "CVSS 9.8  |  status: unpatched" },
  { kind: "Vulnerability", label: "CVE-2025-4101 Privilege escalation", detail: "CVSS 8.6  |  status: open" },
  { kind: "Vulnerability", label: "CVE-2024-1709 SQL injection",     detail: "CVSS 7.5  |  status: patched" },
  { kind: "Actor",         label: "APT29 (Cozy Bear)",               detail: "state-sponsored  |  region: Eastern Europe" },
  { kind: "Actor",         label: "APT41 (Double Dragon)",           detail: "state-sponsored  |  region: East Asia" },
  { kind: "Actor",         label: "FIN7 (Carbanak)",                 detail: "financial  |  region: Eastern Europe" },
];

const FILTER_HINTS = [
  { prefix: "severity:",  values: "critical | high | medium | low" },
  { prefix: "source:",    values: "SIEM | EDR | TI | NIDS" },
  { prefix: "type:",      values: "event | incident | endpoint | vulnerability | actor" },
  { prefix: "status:",    values: "open | investigating | contained | closed | compromised | patched" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Badge({ kind }: { kind: EntityKind }) {
  const b = ENTITY_BADGE[kind];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${b.bg} ${b.text}`}>
      {kind}
    </span>
  );
}

function mapApiTypeToKind(type: string): EntityKind {
  const map: Record<string, EntityKind> = {
    incident: "Incident",
    alert: "Incident",
    event: "Event",
    knowledge: "Event",
    endpoint: "Endpoint",
  };
  return map[type] ?? "Event";
}

function searchMatches(query: string, label: string, detail: string): boolean {
  const q = query.toLowerCase();
  return label.toLowerCase().includes(q) || detail.toLowerCase().includes(q);
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const role = useAuth((s) => s.user?.role);
  const pages = useMemo(() => visibleFeaturesForRole(role), [role]);
  const [query, setQuery] = useState("");
  const apiSearch = useSearch(query);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  /* Reset input when palette closes */
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const activeFilter = useMemo(() => FILTER_HINTS.find((f) => query.includes(f.prefix)), [query]);

  const groupedResults = useMemo(() => {
    if (query.length < 2) return {} as Record<EntityKind, typeof MOCK_SEARCH>;
    const q = query.toLowerCase();

    if (apiSearch.data?.items?.length) {
      const groups: Record<string, typeof MOCK_SEARCH> = {};
      for (const hit of apiSearch.data.items) {
        const kind = mapApiTypeToKind(hit.type);
        const entry = { kind, label: hit.title || hit.label, detail: hit.label };
        (groups[kind] ??= []).push(entry);
      }
      return groups;
    }

    const matching = MOCK_SEARCH.filter((r) => searchMatches(q, r.label, r.detail));
    const groups: Record<string, typeof MOCK_SEARCH> = {};
    for (const r of matching) {
      (groups[r.kind] ??= []).push(r);
    }
    return groups;
  }, [query, apiSearch.data]);

  const ENTITY_GROUP_ORDER: EntityKind[] = ["Event", "Incident", "Endpoint", "Vulnerability", "Actor"];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 backdrop-blur-sm pt-[15vh] px-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border-strong bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global command palette" className="[&_[cmdk-input]]:bg-transparent" shouldFilter={false}>
          <div className="border-b border-border px-3 py-2.5">
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, events, incidents, actions..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</Command.Empty>

            {/* ---------- Advanced filter hints ---------- */}
            {activeFilter && !query.includes(" ") && (
              <Command.Group heading="Filter" className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                <div className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted-foreground">
                  <Hash className="size-3.5 shrink-0" />
                  <span className="font-mono">{activeFilter.prefix}</span>
                  <span className="text-muted-foreground/70">{activeFilter.values}</span>
                </div>
              </Command.Group>
            )}

            {/* ---------- Global search results ---------- */}
            {query.length >= 2 && Object.keys(groupedResults).length > 0 && (
              <Command.Group heading="Search" className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                {ENTITY_GROUP_ORDER.filter((k) => groupedResults[k]).map((kind) =>
                  groupedResults[kind].map((r) => (
                    <Command.Item
                      key={`${kind}-${r.label}`}
                      value={`search-${r.label}`}
                      onSelect={() => onOpenChange(false)}
                      className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <Badge kind={kind} />
                      <span className="flex-1">{r.label}</span>
                      <span className="max-w-[180px] truncate text-[11px] text-muted-foreground font-mono">{r.detail}</span>
                    </Command.Item>
                  ))
                )}
              </Command.Group>
            )}

            {/* ---------- Saved queries ---------- */}
            {query.length < 2 && (
              <Command.Group heading="Saved Queries" className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                {SAVED_QUERIES.map((sq) => (
                  <Command.Item
                    key={sq.label}
                    value={`sq-${sq.label}`}
                    onSelect={() => { setQuery(sq.filter); }}
                    className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Search className="size-4 text-muted-foreground" />
                    <span className="flex-1">{sq.label}</span>
                    <span className="max-w-[200px] truncate text-[11px] text-muted-foreground font-mono">{sq.filter}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ---------- Recent investigations ---------- */}
            {query.length < 2 && (
              <Command.Group heading="Recent" className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                {RECENT.map((r) => (
                  <Command.Item
                    key={r.to}
                    value={`recent-${r.label}`}
                    onSelect={() => { navigate({ to: r.to }); onOpenChange(false); }}
                    className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Globe className="size-4 text-muted-foreground" />
                    <span className="flex-1">{r.label}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{r.type}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ---------- Pages (role-filtered) ---------- */}
            <Command.Group heading={`Navigate · ${pages.length} available`} className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {pages.length === 0 && (
                <div className="flex items-center gap-2 rounded-md px-2.5 py-3 text-xs text-muted-foreground">
                  <Lock className="size-3.5" /> No modules available for your role.
                </div>
              )}
              {pages.map((p) => {
                const Icon = p.icon;
                return (
                  <Command.Item
                    key={p.to}
                    value={`${p.label} ${p.to}`}
                    onSelect={() => { navigate({ to: p.to }); onOpenChange(false); }}
                    className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{p.label}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{p.to}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* ---------- Actions ---------- */}
            <Command.Group heading="Actions" className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Command.Item
                    key={a.label}
                    value={a.label}
                    onSelect={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{a.label}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{a.hint}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span>NEXUS &bull; Command</span>
            <span>esc to close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
