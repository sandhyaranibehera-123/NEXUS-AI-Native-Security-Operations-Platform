import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MessageSquare, ShieldAlert, Star, User, Clock, TriangleAlert as AlertTriangle, ChevronUp, FileText, CircleCheck as CheckCircle2, Circle, Loader as Loader2, Circle as XCircle, Paperclip, Network, Monitor, File as FileIcon, Globe, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SEED_INCIDENTS } from "@/lib/mock/generators";
import { useIncident, useUpdateIncidentStatus } from "@/lib/api-hooks";
import type { IncidentDto } from "@nexus/shared";
import { SeverityBadge } from "@/components/severity-badge";
import { formatDistanceToNow, differenceInMinutes, differenceInSeconds } from "date-fns";
import { cn } from "@/lib/utils";
import type { Incident, IncidentStatus, Severity } from "@/lib/mock/types";
import { useIncidentStore } from "@/lib/incident-store";
import { useAuth } from "@/lib/auth-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/incidents/$incidentId")({
  head: ({ params }) => {
    const i = SEED_INCIDENTS.find((x) => x.code === params.incidentId);
    return {
      meta: [
        { title: i ? `${i.code} — NEXUS` : "Incident — NEXUS" },
        { name: "description", content: i?.title ?? "Incident detail" },
      ],
    };
  },
  component: IncidentDetailPage,
});

const STATUSES: IncidentStatus[] = ["open", "investigating", "contained", "resolved"];

const STATUS_STYLE: Record<IncidentStatus, string> = {
  open: "bg-critical/15 text-critical border-critical/40",
  investigating: "bg-high/15 text-high border-high/40",
  contained: "bg-info/15 text-info border-info/40",
  resolved: "bg-healthy/15 text-healthy border-healthy/40",
};

const ANALYSTS = ["k.morgan", "a.chen", "m.patel", "j.lee", "amelia.lee", "h.tanaka"];

// --- Mock data for advanced features ---

type EvidenceType = "log" | "screenshot" | "network" | "file" | "endpoint";
const EVIDENCE_ICONS: Record<EvidenceType, LucideIcon> = {
  log: FileText,
  screenshot: Monitor,
  network: Network,
  file: FileIcon,
  endpoint: Globe,
};
const EVIDENCE_COLORS: Record<EvidenceType, string> = {
  log: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  screenshot: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  network: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  file: "bg-rose-500/15 text-rose-400 border-rose-500/40",
  endpoint: "bg-teal-500/15 text-teal-400 border-teal-500/40",
};

const MOCK_EVIDENCE: { id: string; type: EvidenceType; name: string; timestamp: string; source: string }[] = [
  { id: "EV-001", type: "log", name: "auth-service-2026-05-23.log", timestamp: "2026-05-23T14:12:03Z", source: "prod-log-aggregator" },
  { id: "EV-002", type: "screenshot", name: "suspicious-login-ui.png", timestamp: "2026-05-23T14:18:45Z", source: "soc-analyst-upload" },
  { id: "EV-003", type: "network", name: "pcap-exfil-session-0782", timestamp: "2026-05-23T14:25:19Z", source: "network-monitor" },
  { id: "EV-004", type: "file", name: "dropper_payload.exe", timestamp: "2026-05-23T14:31:02Z", source: "endpoint-scan" },
  { id: "EV-005", type: "endpoint", name: "WORKSTATION-442", timestamp: "2026-05-23T14:33:11Z", source: "edr-agent" },
  { id: "EV-006", type: "log", name: "firewall-deny-2026-05-23.log", timestamp: "2026-05-23T14:40:55Z", source: "firewall-gateway" },
];

type ResponderRole = "lead" | "support" | "reviewer";
const ROLE_STYLES: Record<ResponderRole, string> = {
  lead: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  support: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  reviewer: "bg-teal-500/15 text-teal-400 border-teal-500/40",
};

const MOCK_RESPONDERS: { name: string; role: ResponderRole; joinedAt: string }[] = [
  { name: "k.morgan", role: "lead", joinedAt: "2026-05-23T14:05:00Z" },
  { name: "a.chen", role: "support", joinedAt: "2026-05-23T14:10:00Z" },
  { name: "m.patel", role: "support", joinedAt: "2026-05-23T14:15:00Z" },
  { name: "j.lee", role: "reviewer", joinedAt: "2026-05-23T14:45:00Z" },
];

const MOCK_SLA = {
  targetMinutes: 240,
  startedAt: "2026-05-23T14:05:00Z",
  escalationAt: 180,
};

const MOCK_ESCALATIONS: { from: Severity; to: Severity; reason: string; at: string; by: string }[] = [
  { from: "medium", to: "high", reason: "Scope expanded to production fleet", at: "2026-05-23T14:20:00Z", by: "k.morgan" },
  { from: "high", to: "critical", reason: "Active exfiltration confirmed", at: "2026-05-23T14:35:00Z", by: "k.morgan" },
];

const MOCK_COMMS: { from: string; to: string; message: string; at: string }[] = [
  { from: "k.morgan", to: "a.chen", message: "Can you pull the auth logs for the affected service? Need to correlate with the network capture.", at: "2026-05-23T14:12:00Z" },
  { from: "a.chen", to: "k.morgan", message: "On it. Seeing repeated failed auth attempts from 10.0.4.77 starting at 14:02 UTC. Cross-referencing with EDR data now.", at: "2026-05-23T14:16:00Z" },
  { from: "m.patel", to: "k.morgan", message: "Network team has isolated the suspect subnet. Containment in progress.", at: "2026-05-23T14:22:00Z" },
  { from: "k.morgan", to: "all", message: "Escalating to critical — active exfiltration confirmed on port 443 outbound. All hands on deck.", at: "2026-05-23T14:35:00Z" },
  { from: "j.lee", to: "k.morgan", message: "Running forensic snapshot of WORKSTATION-442. Will have image in 20 min.", at: "2026-05-23T14:48:00Z" },
];

type RCAStep = "identify" | "analyze" | "confirm" | "document";
const RCA_STEPS: { key: RCAStep; label: string }[] = [
  { key: "identify", label: "Identify" },
  { key: "analyze", label: "Analyze" },
  { key: "confirm", label: "Confirm" },
  { key: "document", label: "Document" },
];
const RCA_STEP_INDEX: Record<RCAStep, number> = { identify: 0, analyze: 1, confirm: 2, document: 3 };

type RemediationStatus = "pending" | "in_progress" | "complete";
const REMEDIATION_ICONS: Record<RemediationStatus, LucideIcon> = {
  pending: Circle,
  in_progress: Loader2,
  complete: CheckCircle2,
};
const REMEDIATION_COLORS: Record<RemediationStatus, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-amber-400",
  complete: "text-emerald-400",
};

const MOCK_REMEDIATIONS: {
  id: string;
  title: string;
  assignee: string;
  status: RemediationStatus;
  dueDate: string;
}[] = [
  { id: "REM-1", title: "Revoke compromised API tokens", assignee: "a.chen", status: "complete", dueDate: "2026-05-23T15:00:00Z" },
  { id: "REM-2", title: "Patch authentication bypass CVE-2026-4472", assignee: "m.patel", status: "in_progress", dueDate: "2026-05-23T16:00:00Z" },
  { id: "REM-3", title: "Rotate all service account credentials", assignee: "j.lee", status: "pending", dueDate: "2026-05-23T18:00:00Z" },
  { id: "REM-4", title: "Deploy updated EDR signatures", assignee: "k.morgan", status: "pending", dueDate: "2026-05-23T20:00:00Z" },
  { id: "REM-5", title: "Conduct full fleet audit for lateral movement", assignee: "a.chen", status: "pending", dueDate: "2026-05-24T00:00:00Z" },
];

// --- Component ---

function dtoToIncident(d: IncidentDto): Incident {
  const status = (["eradicated", "recovered", "closed"].includes(d.status)
    ? "resolved"
    : d.status) as IncidentStatus;
  return {
    id: d.id,
    code: d.code,
    title: d.title,
    severity: d.severity as Incident["severity"],
    status,
    assignee: d.assignee ?? "Unassigned",
    openedAt: d.openedAt,
    updatedAt: d.updatedAt,
    affectedAssets: d.affectedAssets,
    affectedUsers: d.affectedUsers,
    category: d.category ?? "",
    mitre: d.mitre,
    summary: d.summary ?? "",
    timeline: d.timeline,
    rca: d.rca ?? "",
    recommendations: d.recommendations,
    linkedEventIds: d.linkedEventIds,
  };
}

function IncidentDetailPage() {
  const { incidentId } = Route.useParams();
  const { data: apiIncident } = useIncident(incidentId);
  const seedBase = SEED_INCIDENTS.find((x) => x.code === incidentId);
  const base: Incident | undefined = apiIncident ? dtoToIncident(apiIncident) : seedBase;
  const override = useIncidentStore((s) => s.overrides[incidentId]);
  const setStatus = useIncidentStore((s) => s.setStatus);
  const setAssignee = useIncidentStore((s) => s.setAssignee);
  const addNote = useIncidentStore((s) => s.addNote);
  const toggleStar = useIncidentStore((s) => s.toggleStar);
  const me = useAuth((s) => s.user);
  const [note, setNote] = useState("");
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [rcaStep, setRcaStep] = useState<RCAStep>("analyze");
  const [commsMsg, setCommsMsg] = useState("");
  const [postmortemGenerated, setPostmortemGenerated] = useState(false);

  if (!base) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Incident <span className="font-mono">{incidentId}</span> not found.
      </div>
    );
  }

  const i: Incident = {
    ...base,
    status: override?.status ?? base.status,
    assignee: override?.assignee ?? base.assignee,
  };

  const onPostNote = () => {
    if (!note.trim()) return;
    addNote(incidentId, me?.name ?? "analyst", note.trim());
    setNote("");
  };

  // SLA calculations
  const slaStart = new Date(MOCK_SLA.startedAt);
  const now = new Date();
  const elapsedMin = differenceInMinutes(now, slaStart);
  const slaPercent = Math.min(100, (elapsedMin / MOCK_SLA.targetMinutes) * 100);
  const remainingMin = Math.max(0, MOCK_SLA.targetMinutes - elapsedMin);
  const breached = elapsedMin >= MOCK_SLA.targetMinutes;
  const escalationTriggered = elapsedMin >= MOCK_SLA.escalationAt;

  // RCA progress
  const rcaPercent = ((RCA_STEP_INDEX[rcaStep] + 1) / RCA_STEPS.length) * 100;

  // Remediation progress
  const remComplete = MOCK_REMEDIATIONS.filter((r) => r.status === "complete").length;
  const remPercent = (remComplete / MOCK_REMEDIATIONS.length) * 100;

  return (
    <div className="p-6 space-y-5 max-w-[1500px] mx-auto">
      <Link to="/incidents" className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All incidents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={i.severity} />
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-mono", STATUS_STYLE[i.status])}>
              {i.status}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">{i.code} &bull; {i.category}</span>
            <button onClick={() => toggleStar(incidentId)} className="text-muted-foreground hover:text-high">
              <Star className={cn("size-3.5", override?.starred && "fill-high text-high")} />
            </button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight max-w-3xl text-balance">{i.title}</h1>
          <div className="text-[11px] font-mono text-muted-foreground">
            opened {formatDistanceToNow(new Date(i.openedAt), { addSuffix: true })} &bull; updated {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })} &bull; assignee {i.assignee}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={i.assignee}
            onChange={(e) => setAssignee(incidentId, e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm hover:bg-surface-2 font-mono"
          >
            {[i.assignee, ...ANALYSTS.filter((a) => a !== i.assignee)].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div className="flex items-center rounded-md border border-border bg-surface overflow-hidden">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(incidentId, s)}
                className={cn(
                  "px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wider",
                  i.status === s
                    ? STATUS_STYLE[s]
                    : "text-muted-foreground hover:bg-surface-2",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          <Panel title="Summary" subtitle="AI-generated overview">
            <p className="text-sm leading-relaxed">{i.summary}</p>
          </Panel>

          <Panel title="Root cause analysis">
            <p className="text-sm leading-relaxed text-muted-foreground">{i.rca}</p>
          </Panel>

          {/* --- Communication Timeline --- */}
          <Panel title="Communication Timeline" subtitle={`${MOCK_COMMS.length} messages`}>
            <div className="space-y-3">
              {MOCK_COMMS.map((c, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-md border border-border bg-background p-3">
                  <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                    {c.from.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[12px] font-medium">{c.from}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">&rarr;</span>
                      <span className="text-[12px] font-medium text-primary">{c.to}</span>
                      <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(c.at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.message}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={commsMsg}
                  onChange={(e) => setCommsMsg(e.target.value)}
                  placeholder="Send update to responders..."
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
                <button
                  disabled={!commsMsg.trim()}
                  onClick={() => { if (commsMsg.trim()) { setCommsMsg(""); } }}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="size-3.5" /> Send
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="Timeline" subtitle={`${i.timeline.length + (override?.notes.length ?? 0)} activities`}>
            <ol className="relative border-l border-border ml-1.5 space-y-4 pl-5">
              {i.timeline.map((t, idx) => (
                <li key={idx} className="relative">
                  <span className="absolute -left-[26px] top-1 grid size-3 place-items-center rounded-full border border-border bg-background">
                    <span className="size-1.5 rounded-full bg-primary" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                      {new Date(t.at).toLocaleString()}
                    </span>
                    <span className="text-[11px] font-mono text-primary">{t.actor}</span>
                  </div>
                  <div className="text-sm">{t.action}</div>
                  {t.detail && <div className="text-[12px] text-muted-foreground">{t.detail}</div>}
                </li>
              ))}
            </ol>
          </Panel>

          {/* --- Root Cause Workflow --- */}
          <Panel title="Root Cause Workflow" subtitle={`Step ${RCA_STEP_INDEX[rcaStep] + 1} of ${RCA_STEPS.length}`}>
            <div className="space-y-4">
              <Progress value={rcaPercent} className="h-2" />
              <div className="flex items-center gap-1">
                {RCA_STEPS.map((step, idx) => {
                  const active = step.key === rcaStep;
                  const done = idx < RCA_STEP_INDEX[rcaStep];
                  return (
                    <button
                      key={step.key}
                      onClick={() => setRcaStep(step.key)}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider text-center transition-colors",
                        active && "border-primary bg-primary/15 text-primary",
                        done && "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                        !active && !done && "border-border text-muted-foreground hover:bg-surface-2",
                      )}
                    >
                      {done && <CheckCircle2 className="inline size-3 mr-1" />}
                      {step.label}
                    </button>
                  );
                })}
              </div>
              <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                {rcaStep === "identify" && "Gather initial indicators of compromise and define the scope of the incident. Collect all relevant logs, alerts, and telemetry."}
                {rcaStep === "analyze" && "Correlate evidence across sources. Map the attack path and identify the initial access vector and lateral movement techniques."}
                {rcaStep === "confirm" && "Validate the root cause hypothesis with supporting evidence. Cross-reference MITRE ATT&CK techniques and confirm attack chain."}
                {rcaStep === "document" && "Formally document the root cause, attack timeline, and contributing factors for the postmortem report."}
              </div>
            </div>
          </Panel>

          {/* --- Remediation Tracking --- */}
          <Panel title="Remediation Tracking" subtitle={`${remComplete}/${MOCK_REMEDIATIONS.length} complete`}>
            <div className="space-y-3">
              <Progress value={remPercent} className="h-2" />
              <ul className="space-y-2">
                {MOCK_REMEDIATIONS.map((rem) => {
                  const Icon = REMEDIATION_ICONS[rem.status];
                  const overdue = rem.status !== "complete" && new Date(rem.dueDate) < now;
                  return (
                    <li key={rem.id} className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
                      <Icon className={cn("size-4 shrink-0", REMEDIATION_COLORS[rem.status], rem.status === "in_progress" && "animate-spin")} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{rem.title}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {rem.assignee} &bull; due {new Date(rem.dueDate).toLocaleString()}
                        </div>
                      </div>
                      <span className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider shrink-0",
                        rem.status === "complete" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
                        rem.status === "in_progress" && "bg-amber-500/15 text-amber-400 border-amber-500/40",
                        rem.status === "pending" && "bg-surface-2 text-muted-foreground border-border",
                        overdue && "bg-critical/15 text-critical border-critical/40",
                      )}>
                        {overdue ? "overdue" : rem.status.replace("_", " ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Panel>

          <Panel title="Notes" subtitle={`${override?.notes.length ?? 0} posted &bull; persisted locally`}>
            <div className="space-y-3">
              {(override?.notes ?? []).map((n) => (
                <div key={n.id} className="flex items-start gap-2 rounded-md border border-border bg-background p-3">
                  <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                    {n.author.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-medium">{n.author}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{formatDistanceToNow(new Date(n.at), { addSuffix: true })}</span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{n.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2">
                <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                  <User className="size-3.5" />
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onPostNote(); }}
                  placeholder="Add a note for the responder team... (Cmd+Enter to post)"
                  className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  rows={2}
                />
                <button
                  onClick={onPostNote}
                  disabled={!note.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  <MessageSquare className="size-3.5" /> Post
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Impact">
            <KV k="affected assets" v={String(i.affectedAssets)} />
            <KV k="affected users" v={String(i.affectedUsers)} />
            <KV k="category" v={i.category} />
            <KV k="opened" v={new Date(i.openedAt).toLocaleString()} />
            <KV k="last updated" v={new Date(i.updatedAt).toLocaleString()} />
          </Panel>

          {/* --- SLA Tracking --- */}
          <Panel title="SLA Tracking" subtitle={breached ? "BREACHED" : `${remainingMin}m remaining`} icon={Clock}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground">response target</span>
                <span className="text-[13px] font-mono tabular-nums">{MOCK_SLA.targetMinutes}m</span>
              </div>
              <Progress
                value={slaPercent}
                className={cn("h-3", breached ? "[&>div]:bg-critical" : escalationTriggered ? "[&>div]:bg-amber-400" : "[&>div]:bg-primary")}
              />
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-muted-foreground">{elapsedMin}m elapsed</span>
                <span className={cn(
                  breached && "text-critical font-semibold",
                  !breached && escalationTriggered && "text-amber-400 font-semibold",
                  !breached && !escalationTriggered && "text-muted-foreground",
                )}>
                  {breached ? "SLA BREACHED" : `${remainingMin}m remaining`}
                </span>
              </div>
              {escalationTriggered && !breached && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-400">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>Escalation threshold reached at {MOCK_SLA.escalationAt}m</span>
                </div>
              )}
              {breached && (
                <div className="flex items-center gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-[12px] text-critical">
                  <XCircle className="size-3.5 shrink-0" />
                  <span>SLA breached — immediate management escalation required</span>
                </div>
              )}
            </div>
          </Panel>

          {/* --- Responder Assignment --- */}
          <Panel title="Responder Assignment" subtitle={`${MOCK_RESPONDERS.length} responders`}>
            <ul className="space-y-2">
              {MOCK_RESPONDERS.map((r) => (
                <li key={r.name} className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                    {r.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      joined {formatDistanceToNow(new Date(r.joinedAt), { addSuffix: true })}
                    </div>
                  </div>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider shrink-0", ROLE_STYLES[r.role])}>
                    {r.role}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* --- Severity Escalation --- */}
          <Panel title="Severity Escalation" subtitle={`${MOCK_ESCALATIONS.length} escalations`}>
            <div className="space-y-3">
              {MOCK_ESCALATIONS.map((esc, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-md border border-border bg-background p-2.5">
                  <ChevronUp className="size-4 text-critical shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <SeverityBadge severity={esc.from} className="text-[9px] px-1 py-0" />
                      <span className="text-[10px] text-muted-foreground">&rarr;</span>
                      <SeverityBadge severity={esc.to} className="text-[9px] px-1 py-0" />
                    </div>
                    <div className="mt-1 text-[12px]">{esc.reason}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {esc.by} &bull; {formatDistanceToNow(new Date(esc.at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setEscalateOpen(!escalateOpen)}
                className="flex items-center gap-1.5 rounded-md border border-critical/40 bg-critical/10 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-critical hover:bg-critical/20 w-full justify-center"
              >
                <AlertTriangle className="size-3" /> Escalate Severity
              </button>
              {escalateOpen && (
                <div className="space-y-2 rounded-md border border-border bg-background p-3">
                  <textarea
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                    placeholder="Reason for escalation..."
                    className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    rows={2}
                  />
                  <button
                    disabled={!escalateReason.trim()}
                    onClick={() => { setEscalateOpen(false); setEscalateReason(""); }}
                    className="w-full rounded-md bg-critical px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Confirm Escalation
                  </button>
                </div>
              )}
            </div>
          </Panel>

          {/* --- Linked Evidence --- */}
          <Panel title="Linked Evidence" subtitle={`${MOCK_EVIDENCE.length} items`}>
            <ul className="space-y-2">
              {MOCK_EVIDENCE.map((ev) => {
                const Icon = EVIDENCE_ICONS[ev.type];
                return (
                  <li key={ev.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <Icon className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] truncate">{ev.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })} &bull; {ev.source}
                      </div>
                    </div>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider shrink-0", EVIDENCE_COLORS[ev.type])}>
                      {ev.type}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="MITRE ATT&CK">
            <div className="flex flex-wrap gap-1.5">
              {i.mitre.map((m) => (
                <span key={m} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">{m}</span>
              ))}
            </div>
          </Panel>

          <Panel title="Recommended actions" icon={ShieldAlert}>
            <ul className="space-y-1.5 text-sm">
              {i.recommendations.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />{r}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Linked telemetry">
            <ul className="space-y-1 text-[12px] font-mono">
              {i.linkedEventIds.map((id) => (
                <li key={id} className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="truncate">{id}</span>
                  <span className="rounded border border-border bg-background px-1 py-0.5 text-[10px]">event</span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* --- Postmortem Generation --- */}
          <Panel title="Postmortem" icon={FileText}>
            <div className="space-y-3">
              {i.status !== "resolved" && (
                <div className="text-[12px] text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="size-3" />
                  Postmortem is typically generated after resolution
                </div>
              )}
              <button
                onClick={() => setPostmortemGenerated(true)}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
              >
                <FileText className="size-3.5" /> Generate Postmortem
              </button>
              {postmortemGenerated && (
                <div className="space-y-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-[12px]">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="size-3.5" /> Template generated
                  </div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>1. Incident summary &amp; timeline</li>
                    <li>2. Root cause analysis</li>
                    <li>3. Impact assessment</li>
                    <li>4. Detection &amp; response evaluation</li>
                    <li>5. Remediation actions taken</li>
                    <li>6. Lessons learned &amp; action items</li>
                  </ul>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface/60">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-3.5 text-primary" />}
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        {subtitle && <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{subtitle}</span>}
      </header>
      <div className="p-4 space-y-2">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground">{k}</span>
      <span className="text-[13px]">{v}</span>
    </div>
  );
}
