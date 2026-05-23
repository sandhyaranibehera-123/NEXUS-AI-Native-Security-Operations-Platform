import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MessageSquare, ShieldAlert, Star, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SEED_INCIDENTS } from "@/lib/mock/generators";
import { SeverityBadge } from "@/components/severity-badge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Incident, IncidentStatus } from "@/lib/mock/types";
import { useIncidentStore } from "@/lib/incident-store";
import { useAuth } from "@/lib/auth-store";

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

function IncidentDetailPage() {
  const { incidentId } = Route.useParams();
  const base: Incident | undefined = SEED_INCIDENTS.find((x) => x.code === incidentId);
  const override = useIncidentStore((s) => s.overrides[incidentId]);
  const setStatus = useIncidentStore((s) => s.setStatus);
  const setAssignee = useIncidentStore((s) => s.setAssignee);
  const addNote = useIncidentStore((s) => s.addNote);
  const toggleStar = useIncidentStore((s) => s.toggleStar);
  const me = useAuth((s) => s.user);
  const [note, setNote] = useState("");

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
            <span className="text-[11px] font-mono text-muted-foreground">{i.code} • {i.category}</span>
            <button onClick={() => toggleStar(incidentId)} className="text-muted-foreground hover:text-high">
              <Star className={cn("size-3.5", override?.starred && "fill-high text-high")} />
            </button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight max-w-3xl text-balance">{i.title}</h1>
          <div className="text-[11px] font-mono text-muted-foreground">
            opened {formatDistanceToNow(new Date(i.openedAt), { addSuffix: true })} • updated {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })} • assignee {i.assignee}
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

          <Panel title="Notes" subtitle={`${override?.notes.length ?? 0} posted • persisted locally`}>
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
                  placeholder="Add a note for the responder team… (⌘+Enter to post)"
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
