import { useState } from "react";
import { Check, ChevronDown, ShieldCheck, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ROLE_LABEL, ROLE_DESCRIPTION, ROLE_PERMISSIONS, type Role } from "@/lib/rbac";
import { ROLES_BY_RANK, ROLE_RANK, canManageRole } from "@/lib/role-hierarchy";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ROLES_BY_RANK;

export function RoleSwitcher() {
  const [open, setOpen] = useState(false);
  const user = useAuth((s) => s.user);
  const setRole = useAuth((s) => s.setRole);
  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="hidden md:flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ShieldCheck className="size-3.5 text-primary" />
        <span className="text-foreground">{ROLE_LABEL[user.role]}</span>
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-mono text-muted-foreground border-b border-border">
              Switch role (demo)
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {ROLES.map((r) => {
                const active = user.role === r;
                return (
                  <li key={r}>
                    <button
                      onClick={() => {
                        setRole(r);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 hover:bg-surface flex items-start gap-2",
                        active && "bg-surface/70",
                      )}
                    >
                      <Check className={cn("mt-0.5 size-3.5 shrink-0", active ? "text-primary" : "text-transparent")} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium">{ROLE_LABEL[r]}</div>
                        <div className="text-[10px] text-muted-foreground">{ROLE_DESCRIPTION[r]}</div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          {ROLE_PERMISSIONS[r].length} permissions
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
