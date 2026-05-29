import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Compass, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { ROLE_LABEL, type Role } from "@/lib/rbac";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — NEXUS" },
      { name: "description", content: "Sign in to the NEXUS security operations console." },
    ],
  }),
  component: LoginPage,
});

const ROLES: Role[] = [
  "super_admin", "security_admin", "soc_analyst", "threat_hunter",
  "incident_responder", "compliance_officer", "viewer",
];

function LoginPage() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("amelia.lee@acme.federal");
  const [password, setPassword] = useState("NexusDemo2024!");
  const [role, setRole] = useState<Role>("security_admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, role);
      navigate({ to: "/dashboard" });
    } catch {
      setError("Sign-in failed. Start the API (npm run dev:api) and database, or check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/60" />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden lg:flex flex-col justify-between p-10 border-r border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/40">
              <Compass className="size-4" />
            </div>
            <span className="font-semibold tracking-tight">NEXUS</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Sec Ops</span>
          </Link>

          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance">
              AI-native security operations, from signal to containment.
            </h1>
            <p className="text-muted-foreground">
              Unified SIEM, threat intelligence, endpoint, identity, and cloud — orchestrated by a copilot
              that thinks like your best analyst.
            </p>
            <div className="grid grid-cols-3 gap-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <Stat n="2.4B" l="events/day" />
              <Stat n="42ms" l="median detect" />
              <Stat n="99.99%" l="uptime" />
            </div>
          </div>

          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            SOC2 • ISO 27001 • HIPAA • FedRAMP-ready
          </div>
        </div>

        {/* Form */}
        <div className="flex items-center justify-center p-6 lg:p-10">
          <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-surface/60 p-6 backdrop-blur">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-muted-foreground">
                <ShieldCheck className="size-3.5 text-healthy" /> Secure operator sign-in
              </div>
              <h2 className="text-lg font-semibold">Sign in to your workspace</h2>
            </div>

            <div className="space-y-3">
              <Field label="Work email">
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </Field>
              <Field label="Demo role">
                <select
                  value={role} onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </Field>
            </div>

            {error && (
              <p className="text-xs text-critical rounded-md border border-critical/30 bg-critical/10 px-3 py-2">{error}</p>
            )}

            <button
              disabled={loading}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Continue"}
            </button>

            <div className="relative my-1 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <span className="relative bg-surface/60 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">or</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-surface">Google</button>
              <button type="button" className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-surface">GitHub</button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              By continuing you accept the operator acceptable-use policy.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-md border border-border bg-surface/40 p-3">
      <div className="text-lg text-foreground font-semibold">{n}</div>
      <div className="text-[10px]">{l}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
