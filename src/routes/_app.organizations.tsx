import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2, Crown, Users, UserPlus, Shield, Trash2, Pencil, Search,
  ChevronRight, Lock, CheckCircle2, Clock, Ban,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import {
  assignableRoles, buildHierarchyTree, canManageRole,
  ROLE_RANK, ROLES_BY_RANK, type HierarchyNode,
} from "@/lib/role-hierarchy";
import { useAccounts, type Account } from "@/lib/accounts-store";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { AccessDenied } from "@/components/access-denied";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/organizations")({
  head: () => ({ meta: [{ title: "Organization & Accounts — NEXUS" }] }),
  component: OrganizationPage,
});

function OrganizationPage() {
  const role = useAuth((s) => s.user?.role);
  const me = useAuth((s) => s.user);
  const accounts = useAccounts((s) => s.accounts);
  const createAccount = useAccounts((s) => s.createAccount);
  const updateAccount = useAccounts((s) => s.updateAccount);
  const deleteAccount = useAccounts((s) => s.deleteAccount);
  const active = useWorkspaceStore((s) => s.getActiveWorkspace());
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  if (!role || (role !== "super_admin" && role !== "security_admin")) {
    return <AccessDenied role={role ?? "viewer"} permission="manage:org" path="/organizations" />;
  }

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    });
  }, [accounts, query, roleFilter]);

  const counts = useMemo(() => {
    const c: Record<Role, number> = {
      super_admin: 0, security_admin: 0, soc_analyst: 0, threat_hunter: 0,
      incident_responder: 0, compliance_officer: 0, viewer: 0,
    };
    accounts.forEach((a) => { c[a.role]++; });
    return c;
  }, [accounts]);

  const tree = useMemo(() => buildHierarchyTree(), []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Govern · Identity</div>
          <h1 className="text-2xl font-semibold tracking-tight">Organization & Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tenants, workspaces, and the role hierarchy. Each role can only manage roles below its own rank.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90"
        >
          <UserPlus className="size-4" /> New account
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Workspaces" value={workspaces.length} icon={Building2} />
        <Kpi label="Members" value={accounts.length} icon={Users} tone="info" />
        <Kpi label="Invited" value={accounts.filter(a => a.status === "invited").length} icon={Clock} tone="high" />
        <Kpi label="Suspended" value={accounts.filter(a => a.status === "suspended").length} icon={Ban} tone="critical" />
        <Kpi label="Super Admins" value={counts.super_admin} icon={Crown} tone="healthy" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* LEFT: Accounts table */}
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-md border border-border bg-surface/60 pl-8 pr-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface/60 p-0.5 overflow-x-auto">
              {(["all", ...ROLES_BY_RANK] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r as Role | "all")}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap",
                    roleFilter === r ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r === "all" ? "All" : ROLE_LABEL[r as Role]}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Member</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-left px-3 py-2">Workspace</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Last active</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const canManage = canManageRole(role, a.role) && a.id !== me?.id;
                  return (
                    <tr key={a.id} className="border-t border-border hover:bg-surface/40">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                            {a.name.split(" ").map(p => p[0]).join("").slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{a.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><RoleBadge role={a.role} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{a.workspace}</td>
                      <td className="px-3 py-2"><StatusPill status={a.status} /></td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground font-mono">
                        {a.lastActive ? timeAgo(a.lastActive) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            disabled={!canManage}
                            onClick={() => canManage && setEditing(a)}
                            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
                            title={canManage ? "Edit" : "Insufficient rank"}
                          >
                            {canManage ? <Pencil className="size-3.5" /> : <Lock className="size-3.5" />}
                          </button>
                          <button
                            disabled={!canManage}
                            onClick={() => canManage && confirm(`Delete ${a.name}?`) && deleteAccount(a.id)}
                            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-critical hover:bg-critical/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={canManage ? "Delete" : "Insufficient rank"}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No accounts match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Hierarchy + workspace */}
        <div className="space-y-4">
          <Panel title="Role hierarchy" icon={Shield}>
            <HierarchyView node={tree} counts={counts} />
            <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
              You are signed in as <span className="text-foreground font-medium">{me?.name}</span>
              {role && <> ({ROLE_LABEL[role]}, rank {ROLE_RANK[role]})</>}. You can manage{" "}
              {assignableRoles(role).length} role tier
              {assignableRoles(role).length === 1 ? "" : "s"}.
            </p>
          </Panel>

          <Panel title="Active workspace" icon={Building2}>
            <div className="space-y-1.5 text-sm">
              <div className="font-medium">{active.orgName}</div>
              <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                {active.name} · {active.environment}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <Stat label="Alerts" value={active.stats.activeAlerts.toLocaleString()} />
                <Stat label="Incidents" value={active.stats.openIncidents} />
                <Stat label="Vulns" value={active.stats.unresolvedVulns} />
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {(creating || editing) && (
        <AccountDialog
          account={editing}
          actorRole={role}
          workspaces={workspaces.map((w) => w.name)}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(payload) => {
            if (editing) {
              updateAccount(editing.id, payload);
            } else {
              createAccount({ ...payload, createdBy: me?.id ?? "system" });
            }
            setCreating(false); setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// -------- helpers --------

function Kpi({ label, value, icon: Icon, tone = "default" }: { label: string; value: number | string; icon: React.ElementType; tone?: "default" | "info" | "high" | "critical" | "healthy"; }) {
  const toneCls = {
    default: "text-foreground",
    info: "text-primary",
    high: "text-amber-400",
    critical: "text-critical",
    healthy: "text-healthy",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span>{label}</span><Icon className={cn("size-3.5", toneCls)} />
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", toneCls)}>{value}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-2 py-1.5">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const tone =
    role === "super_admin" ? "bg-critical/15 text-critical border-critical/30"
    : role === "security_admin" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : role === "compliance_officer" ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
    : role === "viewer" ? "bg-muted/30 text-muted-foreground border-border"
    : "bg-primary/15 text-primary border-primary/30";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider", tone)}>
      {role === "super_admin" && <Crown className="size-3" />}
      {ROLE_LABEL[role]}
    </span>
  );
}

function StatusPill({ status }: { status: Account["status"] }) {
  const map = {
    active:    { cls: "bg-healthy/15 text-healthy border-healthy/30", icon: CheckCircle2 },
    invited:   { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Clock },
    suspended: { cls: "bg-critical/15 text-critical border-critical/30", icon: Ban },
  }[status];
  const Icon = map.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider", map.cls)}>
      <Icon className="size-3" /> {status}
    </span>
  );
}

function HierarchyView({ node, counts, depth = 0 }: { node: HierarchyNode; counts: Record<Role, number>; depth?: number }) {
  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1.5"
        style={{ marginLeft: depth * 14 }}
      >
        {depth > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
        <RoleBadge role={node.role} />
        <span className="ml-auto text-[11px] text-muted-foreground font-mono">
          {counts[node.role]} · r{ROLE_RANK[node.role]}
        </span>
      </div>
      {node.children.map((c) => (
        <HierarchyView key={c.role} node={c} counts={counts} depth={depth + 1} />
      ))}
    </div>
  );
}

function AccountDialog({
  account, actorRole, workspaces, onClose, onSave,
}: {
  account: Account | null;
  actorRole: Role | undefined;
  workspaces: string[];
  onClose: () => void;
  onSave: (data: Omit<Account, "id" | "createdAt" | "lastActive" | "createdBy">) => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [role, setRole] = useState<Role>(account?.role ?? (assignableRoles(actorRole)[0] ?? "viewer"));
  const [workspace, setWorkspace] = useState(account?.workspace ?? workspaces[0] ?? "Acme Production");
  const [status, setStatus] = useState<Account["status"]>(account?.status ?? "invited");

  const allowedRoles = assignableRoles(actorRole);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-popover shadow-2xl"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{account ? "Edit account" : "Create account"}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            You can only assign roles below your own rank.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]} (rank {ROLE_RANK[r]})</option>
              ))}
            </select>
          </Field>
          <Field label="Workspace">
            <select value={workspace} onChange={(e) => setWorkspace(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
              {workspaces.map((w) => <option key={w} value={w}>{w}</option>)}
              <option value="all">All workspaces</option>
            </select>
          </Field>
          <Field label="Status">
            <div className="flex gap-1.5">
              {(["active", "invited", "suspended"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider",
                    status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="border-t border-border px-4 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border bg-surface/60 px-3 py-1.5 text-sm hover:bg-surface">Cancel</button>
          <button
            disabled={!name || !email}
            onClick={() => onSave({ name, email, role, workspace, status })}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {account ? "Save changes" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
