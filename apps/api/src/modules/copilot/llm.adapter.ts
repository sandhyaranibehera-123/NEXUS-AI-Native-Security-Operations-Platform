import OpenAI from "openai";
import {
  SYSTEM_PROMPTS, DEFAULT_CHAT_MODEL, redactPii, detectPromptInjection, MODEL_DEFAULTS,
} from "@nexus/ai-contracts";
import type { Env } from "../../config/env.js";
import type { CopilotWorkflow } from "@nexus/shared";

export class LlmAdapter {
  private client: OpenAI | null = null;

  constructor(private env: Env) {
    if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  async *streamChat(
    workflow: CopilotWorkflow | "default",
    userMessage: string,
    context?: string,
  ): AsyncGenerator<{ token: string; done?: boolean; model?: string; tokens?: { prompt: number; output: number } }> {
    const sanitized = redactPii(userMessage);
    if (detectPromptInjection(sanitized)) {
      yield { token: "I cannot process that request due to safety policies.", done: true, model: "safety-filter" };
      return;
    }

    const systemPrompt = SYSTEM_PROMPTS[workflow as keyof typeof SYSTEM_PROMPTS] ?? SYSTEM_PROMPTS.default;
    const fullSystem = context
      ? `${systemPrompt}\n\n--- Context ---\n${context}`
      : systemPrompt;

    if (!this.client) {
      const response = this.fallbackResponse(sanitized, workflow);
      for (const char of response) {
        yield { token: char };
        await sleep(8);
      }
      yield { token: "", done: true, model: "nexus-analyst-v3-fallback", tokens: { prompt: 0, output: response.length } };
      return;
    }

    const model = this.env.CHAT_MODEL || DEFAULT_CHAT_MODEL;
    const stream = await this.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: fullSystem },
        { role: "user", content: sanitized },
      ],
      temperature: MODEL_DEFAULTS.temperature,
      max_tokens: MODEL_DEFAULTS.maxTokens,
      stream: true,
    });

    let outputLen = 0;
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        outputLen += token.length;
        yield { token };
      }
    }
    yield { token: "", done: true, model, tokens: { prompt: sanitized.length, output: outputLen } };
  }

  private fallbackResponse(message: string, workflow: CopilotWorkflow | "default"): string {
    const p = message.toLowerCase();
    if (p.includes("inc-") || p.includes("incident") || workflow === "incident_explanation") {
      return `INC-1042 — Privileged IAM role attached outside change window.

• Severity: HIGH. Actor: build-runner-44 via OIDC.
• Blast radius: aws-prod root + secrets-vault (2 crown jewels reachable).
• Containment: revoke role binding, rotate trust policy, force re-auth on linked identities.

Proposed playbook: aws.revoke_role → vault.rotate → notify #soc-prod. Run it?

*[Degraded mode — configure OPENAI_API_KEY for live LLM responses]*`;
    }
    if (p.includes("sigma") || p.includes("rule") || workflow === "query_generation") {
      return `\`\`\`yaml
title: LSASS Access via rundll32
id: 4f1c-detect-rundll32-lsass
status: experimental
logsource:
  product: windows
  category: process_access
detection:
  selection:
    SourceImage|endswith: '\\\\rundll32.exe'
    TargetImage|endswith: '\\\\lsass.exe'
  condition: selection
level: high
\`\`\`

Deploy to staging tenant?

*[Degraded mode — configure OPENAI_API_KEY for live LLM responses]*`;
    }
    return `I analyzed the relevant telemetry across EDR, identity, and cloud control planes. Here is what I found:

• 3 correlated signals match the MITRE T1078 pattern over the past 4h.
• Two endpoints show beaconing to a domain registered <72h ago.
• Recommended next step: isolate edge-7f2a and revoke the impacted Okta session.

Want me to draft a containment runbook and open an incident?

*[Degraded mode — configure OPENAI_API_KEY for live LLM responses]*`;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
