import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { RotateCcw, Play, Pause, SkipForward, FastForward, Clock, Activity, Shield, TriangleAlert as AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/attack-replay")({
  head: () => ({ meta: [{ title: "Attack Replay — NEXUS" }] }),
  component: AttackReplayPage,

});

const REPLAY_EVENTS = [
  { id: 1, time: "T+0m", title: "Phishing email delivered", type: "entry", severity: "medium" as const, detail: "Email with Log4Shell payload sent to hr@acme.com", actor: "APT29" },
  { id: 2, time: "T+2m", title: "Email opened, attachment executed", type: "exploit", severity: "high" as const, detail: "CV-2025-3192 Log4Shell RCE triggered on prod-web-01", actor: "APT29" },
  { id: 3, time: "T+5m", title: "Initial beacon established", type: "c2", severity: "critical" as const, detail: "DNS callback to c2.nexus-cdn.net (185.220.101.34)", actor: "APT29" },
  { id: 4, time: "T+15m", title: "PowerShell reconnaissance", type: "lateral", severity: "high" as const, detail: "whoami /all, net group \"Domain Admins\"", actor: "APT29" },
  { id: 5, time: "T+30m", title: "Credential harvesting", type: "credential", severity: "critical" as const, detail: "Mimikatz dump of LSASS, obtained svc-backup creds", actor: "APT29" },
  { id: 6, time: "T+45m", title: "Lateral movement to DB server", type: "lateral", severity: "critical" as const, detail: "SMB auth from prod-web-01 to prod-db-03 using svc-backup", actor: "APT29" },
  { id: 7, time: "T+60m", title: "Data staging", type: "exfil", severity: "critical" as const, detail: "2.4GB compressed archive created in C:\\Temp\\", actor: "APT29" },
  { id: 8, time: "T+75m", title: "Exfiltration initiated", type: "exfil", severity: "critical" as const, detail: "HTTPS upload to cloud-storage-example.com at 50MB/s", actor: "APT29" },
  { id: 9, time: "T+80m", title: "Alert: DNS beaconing detected", type: "detection", severity: "high" as const, detail: "NEXUS detection rule SIG-003 triggered", actor: "NEXUS" },
  { id: 10, time: "T+82m", title: "Alert: Suspicious PowerShell", type: "detection", severity: "high" as const, detail: "NEXUS detection rule SIG-002 triggered", actor: "NEXUS" },
  { id: 11, time: "T+85m", title: "Incident INC-2847 opened", type: "response", severity: "critical" as const, detail: "Auto-escalated to P1 by SOC workflow", actor: "SOC" },
  { id: 12, time: "T+90m", title: "Endpoint isolated", type: "response", severity: "high" as const, detail: "prod-web-01 network quarantined by Sarah Chen", actor: "SOC" },
];

const TYPE_COLORS: Record<string, string> = {
  entry: "text-medium", exploit: "text-critical", c2: "text-critical", lateral: "text-high",
  credential: "text-critical", exfil: "text-critical", detection: "text-primary", response: "text-healthy",
};

function AttackReplayPage() {
  const [step, setStep] = useState(8);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2"><RotateCcw className="h-5 w-5 text-primary" />Attack Replay</h1>
        <select className="bg-surface border border-border rounded px-3 py-1 text-xs font-mono">
          <option>INC-2847 — APT29 Intrusion Chain</option>
          <option>INC-2848 — Data Exfiltration</option>
          <option>CASE-7001 — Full Attack Timeline</option>
        </select>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-surface/60">
        <button onClick={() => setStep(0)} className="text-muted-foreground hover:text-foreground"><RotateCcw className="h-4 w-4" /></button>
        <button onClick={() => setPlaying(!playing)} className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/20 text-primary hover:bg-primary/30">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <button onClick={() => setStep((s) => Math.min(s + 1, REPLAY_EVENTS.length - 1))} className="text-muted-foreground hover:text-foreground"><SkipForward className="h-4 w-4" /></button>
        <div className="flex-1 h-1 bg-background rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / REPLAY_EVENTS.length) * 100}%` }} />
        </div>
        <span className="text-xs font-mono text-muted-foreground">{REPLAY_EVENTS[step]?.time}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Timeline */}
        <div className="space-y-0">
          {REPLAY_EVENTS.map((e, i) => (
            <div key={e.id} className={cn("relative flex items-start gap-3", i <= step ? "opacity-100" : "opacity-30")}>
              {/* Vertical line */}
              {i < REPLAY_EVENTS.length - 1 && (
                <div className={cn("absolute left-[15px] top-8 bottom-0 w-px", i < step ? "bg-primary/40" : "bg-border")} />
              )}
              {/* Dot */}
              <span className={cn("mt-1 h-[10px] w-[10px] rounded-full shrink-0 border-2", i === step ? "border-primary bg-primary animate-pulse" : i < step ? "border-primary bg-primary/40" : "border-border bg-background")} />
              <div className={cn("flex-1 px-3 py-2.5 rounded-lg mb-1 transition-colors", i === step && "bg-surface/60 border border-primary/30")}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono text-muted-foreground">{e.time}</span>
                  <span className={cn("text-[9px] font-mono uppercase", TYPE_COLORS[e.type])}>{e.type}</span>
                  <SeverityBadge severity={e.severity} />
                  <span className="text-sm font-medium">{e.title}</span>
                </div>
                {(i <= step) && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">{e.detail}</p>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border bg-background shrink-0">{e.actor}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Current Event</div>
            <div className="text-sm font-semibold">{REPLAY_EVENTS[step]?.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{REPLAY_EVENTS[step]?.detail}</div>
            <div className="flex items-center gap-2 mt-2">
              <SeverityBadge severity={REPLAY_EVENTS[step]?.severity ?? "info"} />
              <span className={cn("text-[9px] font-mono uppercase", TYPE_COLORS[REPLAY_EVENTS[step]?.type ?? ""])}>{REPLAY_EVENTS[step]?.type}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Attack Summary</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-mono">90 minutes</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Detection Time</span><span className="font-mono">80 min (T+80m)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Response Time</span><span className="font-mono">10 min (T+85m)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Attacker</span><span className="font-mono">APT29</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Kill Chain</span><span className="font-mono">6/7 phases</span></div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Speed</div>
            <div className="flex gap-1">
              {["0.5x", "1x", "2x", "5x"].map((s) => (
                <button key={s} className={cn("text-[9px] font-mono px-2 py-1 rounded border transition-colors", s === "1x" ? "bg-primary/20 text-primary border-primary/30" : "text-muted-foreground border-border hover:text-foreground")}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
