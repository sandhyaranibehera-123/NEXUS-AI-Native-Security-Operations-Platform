import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { Activity, Bug, KeyRound, ArrowRightLeft, Shield, Zap, Play, TriangleAlert as AlertTriangle, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_app/threat-simulation")({
  head: () => ({ meta: [{ title: "Threat Simulation — NEXUS" }] }),
  component: ThreatSimulationPage,

});

const SCENARIOS = [
  { id: "sim-1", name: "Ransomware Outbreak", icon: Bug, description: "Simulate ransomware encryption cascade across file servers", phases: ["Initial Access", "Execution", "Encryption", "Lateral Spread", "Exfiltration"], severity: "critical" as const, duration: "~15 min", endpoints: 12 },
  { id: "sim-2", name: "Credential Stuffing", icon: KeyRound, description: "Simulate brute force attack against auth endpoints", phases: ["Target Recon", "Credential Spray", "Account Takeover", "Privilege Escalation"], severity: "high" as const, duration: "~10 min", endpoints: 3 },
  { id: "sim-3", name: "Lateral Movement", icon: ArrowRightLeft, description: "Simulate attacker pivoting through network using Pass-the-Hash", phases: ["Compromised Host", "Hash Extraction", "SMB Relay", "Domain Admin", "Full Compromise"], severity: "critical" as const, duration: "~20 min", endpoints: 8 },
  { id: "sim-4", name: "Phishing Campaign", icon: Shield, description: "Simulate targeted phishing with credential harvesting site", phases: ["Craft Email", "Deliver Payload", "Credential Capture", "Account Access"], severity: "high" as const, duration: "~8 min", endpoints: 5 },
  { id: "sim-5", name: "Supply Chain Attack", icon: Zap, description: "Simulate compromise via poisoned dependency injection", phases: ["Dependency Poison", "CI/CD Infection", "Deploy Malware", "Data Access"], severity: "critical" as const, duration: "~12 min", endpoints: 6 },
];

function ThreatSimulationPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const startSim = (id: string) => {
    setRunning(id);
    setTimeout(() => { setRunning(null); setCompleted((prev) => new Set([...prev, id])); }, 3000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Threat Simulation</h1>
        <span className="text-xs text-muted-foreground">Simulated attacks for detection validation</span>
      </div>

      <div className="rounded-lg border border-high/30 bg-high/5 p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-high shrink-0" />
        <div>
          <div className="text-sm font-medium text-high">Simulation Environment</div>
          <div className="text-xs text-muted-foreground">All simulations run in isolated sandbox. No production impact.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SCENARIOS.map((s) => {
          const isRunning = running === s.id;
          const isDone = completed.has(s.id);
          return (
            <div key={s.id} className={cn("rounded-lg border bg-surface/60 p-5", isRunning && "border-primary/40 animate-pulse", isDone && "border-healthy/30", !isRunning && !isDone && "border-border")}>
              <div className="flex items-center gap-3">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded", isRunning ? "bg-primary/20 text-primary" : isDone ? "bg-healthy/20 text-healthy" : "bg-surface text-muted-foreground")}>
                  <s.icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <SeverityBadge severity={s.severity} />
                    {isDone && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-healthy/30 bg-healthy/10 text-healthy">Completed</span>}
                    {isRunning && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">Running...</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1">
                {s.phases.map((p, i) => (
                  <span key={i} className="flex items-center gap-0.5">
                    <span className={cn("text-[8px] font-mono px-1.5 py-0.5 rounded border", isRunning ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground")}>{p}</span>
                    {i < s.phases.length - 1 && <ArrowRightLeft className="h-2.5 w-2.5 text-muted-foreground" />}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-3 text-[10px] font-mono text-muted-foreground">
                  <span>~{s.duration}</span>
                  <span>{s.endpoints} endpoints</span>
                </div>
                <button
                  onClick={() => !isRunning && startSim(s.id)}
                  disabled={isRunning}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-colors",
                    isRunning ? "bg-primary/20 text-primary cursor-wait" : isDone ? "bg-surface border border-border text-muted-foreground" : "bg-primary/20 text-primary hover:bg-primary/30",
                  )}
                >
                  {isRunning ? <><RotateCcw className="h-3 w-3 animate-spin" />Simulating...</> : isDone ? <><RotateCcw className="h-3 w-3" />Re-run</> : <><Play className="h-3 w-3" />Run Simulation</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
