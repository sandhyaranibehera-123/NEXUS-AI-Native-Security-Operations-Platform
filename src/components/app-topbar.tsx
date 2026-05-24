import { useEffect, useState } from "react";
import { Bell, Circle as CircleHelp, Clock, Command as CmdIcon, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ROLE_LABEL } from "@/lib/rbac";
import { CommandPalette } from "./command-palette";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { RoleSwitcher } from "./role-switcher";
import { useConnectionState, useHeartbeat, useStreamStats } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

const RANGES = ["15m", "1h", "24h", "7d", "30d"];

const UNREAD_COUNT = 7;

export function AppTopbar() {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState("24h");
  const user = useAuth((s) => s.user);
  const heartbeat = useHeartbeat(1800);
  const connection = useConnectionState();
  const stats = useStreamStats();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dotColor = {
    connected: "bg-emerald-400",
    reconnecting: "bg-amber-400 animate-pulse",
    disconnected: "bg-red-500",
  }[connection];

  const isStale = connection === "reconnecting" || connection === "disconnected";

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex h-full items-center gap-3 px-4">
        <WorkspaceSwitcher />

        <button
          onClick={() => setOpen(true)}
          className="group flex w-80 max-w-[40vw] items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-surface"
        >
          <Search className="size-4" />
          <span className="flex-1 truncate">Search events, incidents, assets…</span>
          <span className="hidden items-center gap-1 rounded border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-flex">
            <CmdIcon className="size-3" /> K
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Time range picker */}
          <div className="hidden md:flex items-center gap-1 rounded-md border border-border bg-surface/60 p-0.5">
            <Clock className="ml-2 mr-1 size-3.5 text-muted-foreground" />
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded px-2 py-1 text-[11px] font-mono uppercase tracking-wider",
                  range === r ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Rich stream indicator */}
          <div className="hidden lg:flex items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-[11px] font-mono text-muted-foreground">
            <span className={cn("size-2 rounded-full shrink-0", dotColor)} />
            <span>{connection === "connected" ? "live" : connection}</span>
            <span className="text-foreground tabular-nums">{stats.eventsPerSec || (2400 + heartbeat * 7) % 9999}</span>
            <span>ev/s</span>
            {stats.lagMs > 10 && (
              <span className="text-amber-400 tabular-nums">{stats.lagMs}ms</span>
            )}
          </div>

          {/* Stale data warning */}
          {isStale && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-mono text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>{connection === "reconnecting" ? "Reconnecting…" : "Connection lost"}</span>
            </div>
          )}

          <RoleSwitcher />

          {/* Notification bell with badge */}
          <button className="relative grid size-9 place-items-center rounded-md border border-border bg-surface/60 text-muted-foreground hover:text-foreground">
            <Bell className="size-4" />
            {UNREAD_COUNT > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {UNREAD_COUNT}
              </span>
            )}
          </button>

          {/* Help icon with "What's new" dot */}
          <button className="relative grid size-9 place-items-center rounded-md border border-border bg-surface/60 text-muted-foreground hover:text-foreground">
            <CircleHelp className="size-4" />
            <span className="absolute top-1 right-1.5 size-2 rounded-full bg-emerald-400" />
          </button>

          {/* User pill - clickable to /profile */}
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="flex items-center gap-2 rounded-md border border-border bg-surface/60 pl-2 pr-3 py-1 hover:bg-surface transition-colors"
          >
            <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-primary text-xs font-semibold">
              {(user?.name ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-[12px] font-medium">{user?.name ?? "Operator"}</div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                {user ? ROLE_LABEL[user.role] : "Guest"}
              </div>
            </div>
          </button>
        </div>
      </div>

      <CommandPalette open={open} onOpenChange={setOpen} />
    </header>
  );
}
