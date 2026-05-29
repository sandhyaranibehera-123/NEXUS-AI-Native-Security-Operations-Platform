import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, BrainCircuit, MessageSquare, Send, Sparkles, User, Wand2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-store";
import { apiFetch, apiStream } from "@/lib/api-client";

export const Route = createFileRoute("/_app/copilot")({
  head: () => ({ meta: [{ title: "AI Copilot — NEXUS" }] }),
  component: CopilotPage,
});

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "Summarize INC-1042 and suggest containment",
  "Find all logins from new ASNs in the last 24h",
  "Is CVE-2024-3094 reachable from internet?",
  "Write a Sigma rule for LSASS access via rundll32",
  "Cluster the latest 480 brute-force alerts",
];

const RESPONSES: Record<string, string> = {
  default:
    "I analyzed the relevant telemetry across EDR, identity, and cloud control planes. Here is what I found:\n\n• 3 correlated signals match the MITRE T1078 pattern over the past 4h.\n• Two endpoints show beaconing to a domain registered <72h ago.\n• Recommended next step: isolate edge-7f2a and revoke the impacted Okta session.\n\nWant me to draft a containment runbook and open an incident?",
  incident:
    "INC-1042 — Privileged IAM role attached outside change window.\n\n• Severity: HIGH. Actor: build-runner-44 via OIDC.\n• Blast radius: aws-prod root + secrets-vault (2 crown jewels reachable).\n• Containment: revoke role binding, rotate trust policy, force re-auth on linked identities.\n\nProposed playbook: aws.revoke_role → vault.rotate → notify #soc-prod. Run it?",
  rule:
    "```yaml\ntitle: LSASS Access via rundll32\nid: 4f1c-detect-rundll32-lsass\nstatus: experimental\nlogsource:\n  product: windows\n  category: process_access\ndetection:\n  selection:\n    SourceImage|endswith: '\\rundll32.exe'\n    TargetImage|endswith: '\\lsass.exe'\n    GrantedAccess: '0x1410'\n  condition: selection\nlevel: high\n```\n\nDeploy to staging tenant?",
  asn:
    "Found 41 logins from 7 newly-observed ASNs in the last 24h:\n\n• AS208861 (BulletProof) — 19 successes, 12 distinct identities\n• AS215311 (residential proxy) — 8 successes, 2 admin accounts\n• 4 others below threshold\n\nFlagging k.morgan and j.okafor for impossible-travel review.",
  cve:
    "CVE-2024-3094 reachability analysis (xz-utils backdoor):\n\n• 4 reachable paths from internet → vulnerable hosts.\n• Highest-risk: edge-lb-prod-02 → build-runner-44 (sshd 9.4p1 affected).\n• 12 hosts patched, 3 pending. Compensating control: WAF block on stage-2 payload signature.",
  cluster:
    "Clustered 480 brute-force alerts into 12 incidents:\n\n• 7 attributed to known BulletProof ASN ranges (auto-suppressed).\n• 3 targeted SSO endpoints — escalated to tier-2.\n• 2 novel patterns — opened INC-1138, INC-1139 for review.\nReduced analyst load by ~94%.",
};

function pickResponse(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("inc-") || p.includes("incident")) return RESPONSES.incident;
  if (p.includes("sigma") || p.includes("rule") || p.includes("detection")) return RESPONSES.rule;
  if (p.includes("asn") || p.includes("login")) return RESPONSES.asn;
  if (p.includes("cve") || p.includes("reach")) return RESPONSES.cve;
  if (p.includes("cluster") || p.includes("brute")) return RESPONSES.cluster;
  return RESPONSES.default;
}

function CopilotPage() {
  const user = useAuth((s) => s.user);
  const sessionIdRef = useRef<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "intro",
      role: "assistant",
      text: "I'm NEXUS Copilot — your conversational SOC analyst. I can query telemetry, summarize incidents, draft detections, and orchestrate playbooks. Ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
    const aId = crypto.randomUUID();
    setMsgs((m) => [...m, userMsg, { id: aId, role: "assistant", text: "", streaming: true }]);

    const streamMock = async () => {
      const full = pickResponse(text);
      for (let i = 1; i <= full.length; i++) {
        await new Promise((r) => setTimeout(r, 8));
        setMsgs((m) => m.map((x) => (x.id === aId ? { ...x, text: full.slice(0, i) } : x)));
      }
    };

    try {
      if (user) {
        if (!sessionIdRef.current) {
          const session = await apiFetch<{ id: string }>("/v1/copilot/sessions", {
            method: "POST",
            body: JSON.stringify({ title: text.slice(0, 80) }),
          });
          sessionIdRef.current = session.id;
        }

        await apiStream(
          `/v1/copilot/sessions/${sessionIdRef.current}/messages`,
          { content: text },
          (event) => {
            if (event.type === "token" && typeof event.data === "string") {
              setMsgs((m) =>
                m.map((x) => (x.id === aId ? { ...x, text: x.text + event.data } : x)),
              );
            }
          },
        );
      } else {
        await streamMock();
      }
    } catch {
      await streamMock();
    }

    setMsgs((m) => m.map((x) => (x.id === aId ? { ...x, streaming: false } : x)));
    setBusy(false);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
          <Sparkles className="size-3.5" /> Investigate
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Copilot</h1>
            <p className="text-sm text-muted-foreground">Conversational analyst assistant. Streams in realtime.</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-healthy pulse-dot" /> nexus-analyst-v3</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="size-3" /> avg 1.8s</span>
            <span className="inline-flex items-center gap-1.5"><BrainCircuit className="size-3" /> 4 models</span>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-0 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {msgs.map((m) => (
              <MessageBubble key={m.id} msg={m} userName={user?.name} />
            ))}
          </div>

          <div className="border-t border-border bg-surface/40 px-6 py-3">
            {msgs.length <= 1 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2 rounded-lg border border-border bg-background p-2 focus-within:border-ring"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                placeholder="Ask NEXUS: 'summarize last 24h critical incidents'…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-32"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                <Send className="size-3.5" />
                {busy ? "thinking…" : "Send"}
              </button>
            </form>
            <div className="mt-1.5 text-[10px] font-mono text-muted-foreground">enter to send • shift+enter newline • all actions audit-logged</div>
          </div>
        </div>

        <aside className="hidden lg:flex flex-col border-l border-border bg-surface/40">
          <SidebarSection title="Capabilities" icon={Wand2}>
            <Cap label="Telemetry Q&A" />
            <Cap label="Incident summarization" />
            <Cap label="RCA generation" />
            <Cap label="Sigma / KQL rule drafting" />
            <Cap label="Playbook orchestration" />
            <Cap label="Attack graph reasoning" />
          </SidebarSection>
          <SidebarSection title="Models" icon={BrainCircuit}>
            <KV k="nexus-analyst-v3" v="primary" />
            <KV k="nexus-rca-v2" v="RCA" />
            <KV k="nexus-detector-v1" v="rule synth" />
            <KV k="embedding-large" v="retrieval" />
          </SidebarSection>
          <SidebarSection title="Today" icon={MessageSquare}>
            <KV k="Sessions" v="412" />
            <KV k="Auto-triaged" v="1,204" />
            <KV k="Detections" v="31" />
            <KV k="Spend" v="$48.20" />
          </SidebarSection>
        </aside>
      </div>
    </div>
  );
}

function MessageBubble({ msg, userName }: { msg: Msg; userName?: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full text-xs",
        isUser ? "bg-surface-2 text-foreground" : "bg-primary/20 text-primary",
      )}>
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div className={cn("max-w-[680px] space-y-1", isUser && "items-end")}>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {isUser ? userName ?? "you" : "nexus-analyst-v3"}
        </div>
        <div className={cn(
          "rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser ? "border-border bg-surface" : "border-primary/20 bg-primary/5",
        )}>
          {msg.text}
          {msg.streaming && <span className="ml-0.5 inline-block size-1.5 -translate-y-px animate-pulse bg-primary" />}
        </div>
      </div>
    </div>
  );
}

function SidebarSection({ title, icon: Icon, children }: { title: string; icon: typeof Wand2; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" /> {title}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
function Cap({ label }: { label: string }) {
  return <div className="flex items-center gap-2 text-xs"><span className="size-1.5 rounded-full bg-healthy" />{label}</div>;
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}
