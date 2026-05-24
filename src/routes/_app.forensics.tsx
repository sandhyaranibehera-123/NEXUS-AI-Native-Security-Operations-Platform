import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { FileSearch, File, Cpu, Bug, Clock, MemoryStick, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/forensics")({
  head: () => ({ meta: [{ title: "Forensics — NEXUS" }] }),
  component: ForensicsPage,

});

const FILE_EVENTS = [
  { time: "14:23:01", action: "create", path: "C:\\Temp\\beacon.dll", hash: "a3f2b1c8", size: "245KB", severity: "critical" as const },
  { time: "14:23:15", action: "modify", path: "C:\\Windows\\System32\\drivers\\etc\\hosts", hash: "d4e5f6a7", size: "1KB", severity: "high" as const },
  { time: "14:23:42", action: "create", path: "C:\\Users\\svc\\AppData\\svchost.exe", hash: "b7c8d9e0", size: "89KB", severity: "critical" as const },
  { time: "14:24:01", action: "delete", path: "C:\\Temp\\staging.zip", hash: "—", size: "—", severity: "high" as const },
  { time: "14:24:18", action: "rename", path: "beacon.dll → update.dll", hash: "a3f2b1c8", size: "245KB", severity: "high" as const },
  { time: "14:25:00", action: "create", path: "C:\\ProgramData\\log4j.log", hash: "f1a2b3c4", size: "12KB", severity: "medium" as const },
];

const PROCESSES = [
  { pid: 4832, name: "w3wp.exe", ppid: 712, cmdline: "C:\\Windows\\System32\\inetsrv\\w3wp.exe -ap \"DefaultAppPool\"", user: "SYSTEM", start: "14:00:01", severity: "info" as const },
  { pid: 5104, name: "powershell.exe", ppid: 4832, cmdline: "powershell -enc JABjAGwA...", user: "SYSTEM", start: "14:23:01", severity: "critical" as const },
  { pid: 5210, name: "svchost.exe", ppid: 5104, cmdline: "C:\\Users\\svc\\AppData\\svchost.exe --c2 185.220.101.34", user: "SYSTEM", start: "14:23:42", severity: "critical" as const },
  { pid: 5315, name: "cmd.exe", ppid: 5210, cmdline: "cmd /c whoami /all", user: "SYSTEM", start: "14:24:05", severity: "high" as const },
];

const BINARIES = [
  { name: "beacon.dll", hash: "a3f2b1c8d4e5f6a7", type: "DLL", detection: "Cobalt Strike Beacon", score: 98, severity: "critical" as const },
  { name: "svchost.exe", hash: "b7c8d9e0f1a2b3c4", type: "PE", detection: "Cobalt Strike Stager", score: 95, severity: "critical" as const },
  { name: "update.ps1", hash: "c9d0e1f2a3b4c5d6", type: "Script", detection: "Living-off-the-Land", score: 72, severity: "high" as const },
];

const ARTIFACTS = [
  { type: "Network Socket", detail: "TCP 185.220.101.34:443 ESTABLISHED", pid: 5210 },
  { type: "Mutex", detail: "Global\\{A3F2B1C8-D4E5-F6A7}", pid: 5210 },
  { type: "Loaded DLL", detail: "wininet.dll (HTTP C2 transport)", pid: 5210 },
  { type: "Registry", detail: "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\svchost", pid: 5210 },
];

function ForensicsPage() {
  const [expandedProc, setExpandedProc] = useState<number | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2"><FileSearch className="h-5 w-5 text-primary" />Forensics Workbench</h1>
        <select className="bg-surface border border-border rounded px-3 py-1 text-xs font-mono">
          <option>INC-2847 — prod-web-01</option>
          <option>INC-2848 — prod-db-03</option>
          <option>CASE-7001 — Full APT</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Timeline */}
        <div className="rounded-lg border border-border bg-surface/60">
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <File className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">File System Timeline</span>
          </div>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
            {FILE_EVENTS.map((e, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-surface transition-colors text-xs font-mono">
                <span className="text-muted-foreground w-16">{e.time}</span>
                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", e.action === "create" ? "bg-critical/10 text-critical" : e.action === "delete" ? "bg-high/10 text-high" : e.action === "modify" ? "bg-medium/10 text-medium" : "bg-info/10 text-info")}>
                  {e.action.toUpperCase()}
                </span>
                <span className="truncate flex-1 text-foreground">{e.path}</span>
                <span className="text-muted-foreground">{e.size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Process Tree */}
        <div className="rounded-lg border border-border bg-surface/60">
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Process Tree</span>
          </div>
          <div className="p-3 space-y-0.5">
            {PROCESSES.map((p) => (
              <div key={p.pid}>
                <button
                  onClick={() => setExpandedProc(expandedProc === p.pid ? null : p.pid)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-surface transition-colors",
                    p.severity === "critical" && "border-l-2 border-l-critical",
                    p.severity === "high" && "border-l-2 border-l-high",
                  )}
                  style={{ paddingLeft: `${(PROCESSES.findIndex((pp) => pp.ppid === p.pid && pp.pid > p.pid) >= 0 ? 0 : 0) + 8 + (p.ppid > 1000 ? 16 : 0)}px` }}
                >
                  {expandedProc === p.pid ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <span className="font-mono text-xs text-muted-foreground w-10">{p.pid}</span>
                  <span className="text-xs font-medium">{p.name}</span>
                  <SeverityBadge severity={p.severity} />
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground">{p.user}</span>
                </button>
                {expandedProc === p.pid && (
                  <div className="ml-10 px-2 py-1 text-[10px] font-mono text-muted-foreground bg-background rounded mt-0.5 mb-1">
                    {p.cmdline}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Suspicious Binaries */}
        <div className="rounded-lg border border-border bg-surface/60">
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <Bug className="h-4 w-4 text-critical" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Suspicious Binaries</span>
          </div>
          <div className="divide-y divide-border">
            {BINARIES.map((b) => (
              <div key={b.hash} className="px-4 py-3 hover:bg-surface transition-colors">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={b.severity} />
                  <span className="text-sm font-medium">{b.name}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border">{b.type}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{b.detection}</div>
                <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-muted-foreground">
                  <span>SHA256: {b.hash.slice(0, 16)}...</span>
                  <span className={cn(b.score > 90 ? "text-critical" : b.score > 70 ? "text-high" : "text-medium")}>Threat: {b.score}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Memory Artifacts */}
        <div className="rounded-lg border border-border bg-surface/60">
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <MemoryStick className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Memory Artifacts</span>
          </div>
          <div className="divide-y divide-border">
            {ARTIFACTS.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface transition-colors">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">{a.type}</span>
                <span className="text-xs font-mono flex-1">{a.detail}</span>
                <span className="text-[10px] font-mono text-muted-foreground">PID {a.pid}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
