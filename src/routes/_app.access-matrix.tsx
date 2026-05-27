import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Check, X, Search, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { can, ROLE_LABEL, type Role } from "@/lib/rbac";
import { ROLES_BY_RANK, ROLE_RANK } from "@/lib/role-hierarchy";
import { FEATURE_GROUPS } from "@/lib/workspace-config";
import { cn } from "@/lib/utils";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/_app/access-matrix")({
  head: () => ({ meta: [{ title: "Access Matrix — NEXUS" }] }),
  component: AccessMatrix,
});

function AccessMatrix() {
  const role = useAuth((s) => s.user?.role);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<Role | null>(role ?? null);

  // Limit to roles authoritative users can audit.
  if (!role || (role !== "super_admin" && role !== "security_admin" && role !== "compliance_officer")) {
    return <AccessDenied role={role ?? "viewer"} permission="manage:org" path="/access-matrix" />;
  }

  const features = useMemo(
    () =>
      FEATURE_GROUPS.flatMap((g) =>
        g.features.map((f) => ({ ...f, group: g.label })),
      ).filter((f) =>
        !query.trim() ||
        f.label.toLowerCase().includes(query.toLowerCase()) ||
        f.group.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  const totalsByRole = useMemo(() => {
    const t: Record<Role, number> = {} as Record<Role, number>;
    ROLES_BY_RANK.forEach((r) => {
      t[r] = FEATURE_GROUPS.flatMap((g) => g.features).filter((f) => can(r, f.permission)).length;
    });
    return t;
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Govern · RBAC</div>
        <h1 className="text-2xl font-semibold tracking-tight">Access Matrix</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Authoritative map of every role × every feature. Tap a column header to highlight a role; check{" "}
          <Link to="/organizations" className="text-primary hover:underline">Organization</Link> to assign roles.
        </p>
      </div>

      {/* role summary chips */}
      <div className="flex flex-wrap items-center gap-2">
        {ROLES_BY_RANK.map((r) => (
          <button
            key={r}
            onClick={() => setHighlight(r === highlight ? null : r)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wider",
              highlight === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {r === "super_admin" && <Crown className="size-3" />}
            <ShieldCheck className="size-3" />
            {ROLE_LABEL[r]}
            <span className="ml-1 rounded bg-background/60 px-1 text-foreground tabular-nums">{totalsByRole[r]}</span>
          </button>
        ))}
      </div>

      {/* search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter features…"
          className="w-full rounded-md border border-border bg-surface/60 pl-8 pr-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* matrix */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-[11px] font-mono uppercase tracking-wider text-muted-foreground sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 min-w-[220px]">Feature</th>
              <th className="text-left px-3 py-2">Group</th>
              {ROLES_BY_RANK.map((r) => (
                <th
                  key={r}
                  onClick={() => setHighlight(r === highlight ? null : r)}
                  className={cn(
                    "px-2 py-2 text-center cursor-pointer whitespace-nowrap",
                    highlight === r && "bg-primary/10 text-primary",
                  )}
                  title={`Rank ${ROLE_RANK[r]}`}
                >
                  {ROLE_LABEL[r].replace(/ /g, "\u00a0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <tr key={f.to} className="border-t border-border hover:bg-surface/40">
                  <td className="px-3 py-1.5">
                    <Link to={f.to} className="flex items-center gap-2 hover:text-primary">
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{f.label}</span>
                    </Link>
                    <div className="text-[10px] font-mono text-muted-foreground pl-[22px]">{f.permission}</div>
                  </td>
                  <td className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{f.group}</td>
                  {ROLES_BY_RANK.map((r) => {
                    const allowed = can(r, f.permission);
                    return (
                      <td
                        key={r}
                        className={cn(
                          "px-2 py-1.5 text-center",
                          highlight === r && "bg-primary/5",
                        )}
                      >
                        {allowed ? (
                          <Check className="inline size-4 text-healthy" />
                        ) : (
                          <X className="inline size-4 text-muted-foreground/40" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {features.length === 0 && (
              <tr><td colSpan={2 + ROLES_BY_RANK.length} className="px-3 py-10 text-center text-muted-foreground">No features match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
