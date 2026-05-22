import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, ShieldAlert, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SEED_INCIDENTS } from "@/lib/mock/generators";
import { SeverityBadge } from "@/components/severity-badge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Incident, IncidentStatus } from "@/lib/mock/types";

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

const STATUS_STYLE: Record<IncidentStatus, string> = {
  open: "bg-critical/15 text-critical border-critical/40",
  investigating: "bg-high/15 text-high border-high/40",
  contained: "bg-info/15 text-info border-info/40",
  resolved: "bg-healthy/15 text-healthy border-healthy/40",
};

function IncidentDetailPage() {
  const { incidentId } = Route.useParams();
  const i: Incident | undefined = SEED_INCIDENTS.find((x) => x.code === incidentId);

  if (!i) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Incident <span className="font-mono">{incidentId}</span> not found.
      </div>
    );
  }


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
          </div>
          <h1 className="text-2xl font-semibold tracking-tight max-w-3xl text-balance">{i.title}</h1>
          <div className="text-[11px] font-mono text-muted-foreground">
            opened {formatDistanceToNow(new Date(i.openedAt), { addSuffix: true })} • updated {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })} • assignee {i.assignee}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">Reassign</button>
          <button className="rounded-md border border-high/40 bg-high/10 text-high px-3 py-1.5 text-sm hover:bg-high/15">Escalate</button>
          <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Contain</button>
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

          <Panel title="Timeline" subtitle={`${i.timeline.length} activities`}>
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

          <Panel title="Comments" subtitle="Investigation notes">
            <div className="flex items-start gap-2">
              <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                <User className="size-3.5" />
              </div>
              <textarea
                placeholder="Add a note for the responder team…"
                className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                rows={2}
              />
              <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                <MessageSquare className="size-3.5" /> Post
              </button>
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
