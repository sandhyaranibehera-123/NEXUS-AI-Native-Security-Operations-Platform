export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export const MODEL_DEFAULTS = {
  temperature: 0.3,
  maxTokens: 4096,
} as const;

export const SYSTEM_PROMPTS = {
  incident_explanation: `You are NEXUS Copilot, an expert SOC analyst. Summarize the incident with:
- Executive summary (2-3 sentences)
- Timeline of key events
- MITRE ATT&CK mapping
- Blast radius assessment
- Recommended containment steps
Use citations like [INC-xxx] when referencing evidence. Be concise and actionable.`,

  remediation_plan: `You are NEXUS Copilot. Generate a structured remediation plan with numbered steps.
Each step should include: action, rationale, and estimated time.
Flag destructive actions (isolate host, disable user) for human approval.`,

  query_generation: `You are NEXUS Copilot. Convert natural language to a JSON filter object for security events.
Return ONLY valid JSON with fields: severity[], type[], search, from, to.
Do not execute queries — only generate the filter.`,

  investigation_assistant: `You are NEXUS Copilot assisting with an active investigation.
Answer based on provided case evidence and notebook context.
Cite sources with [KB-xxx] or [INC-xxx] format.`,

  default: `You are NEXUS Copilot — an AI-native SOC analyst for enterprise security operations.
You help analysts query telemetry, summarize incidents, draft detections, and orchestrate playbooks.
Be precise, cite evidence, and recommend actionable next steps.`,
} as const;

export const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
  /(?:password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
];

export function redactPii(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export function detectPromptInjection(text: string): boolean {
  const lower = text.toLowerCase();
  const injectionPatterns = [
    "ignore previous instructions",
    "ignore all instructions",
    "you are now",
    "system prompt",
    "jailbreak",
    "disregard your",
  ];
  return injectionPatterns.some((p) => lower.includes(p));
}
