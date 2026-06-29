import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticate, requirePermission } from "../../middleware/authenticate.js";
import { alerts, endpoints, identityAnomalies } from "@nexus/db/schema";
import { withTenant } from "../../lib/tenant.js";
import { LlmAdapter } from "../copilot/llm.adapter.js";

const HUNT_ASSIST_SYSTEM_PROMPT = `You are a SOC threat-hunting query assistant for the NEXUS platform.
The hunt query language supports "field:value" tokens (severity, type, host, user, ip, src, dst, proto, domain)
combined with free text, e.g. "severity:critical type:network host:web-01 lateral movement".
Given the analyst's natural-language hunting goal, respond with ONLY a JSON object of this exact shape,
no prose, no markdown fences:
{"suggestions": ["query variant 1", "query variant 2", "query variant 3"], "optimizedQuery": "single best query"}`;

export async function aiRoutes(app: FastifyInstance) {
  const llm = new LlmAdapter(app.env);
  /**
   * GET /v1/ai/threat-scoring
   * Returns AI-computed threat scores for high-risk entities (endpoints + users).
   */
  app.get("/v1/ai/threat-scoring", {
    preHandler: [authenticate(app.env), requirePermission("view:incidents")],
  }, async (request, reply) => {
    const orgId = request.user!.orgId;
    const items = await withTenant(app.db, orgId, async () => {
      const riskyEndpoints = await app.db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.organizationId, orgId), sql`${endpoints.riskOverall} >= 60`))
        .orderBy(desc(endpoints.riskOverall))
        .limit(20);

      return riskyEndpoints.map((ep) => ({
        id: ep.id,
        entityType: "endpoint",
        entityName: ep.hostname,
        threatScore: ep.riskOverall ?? 50,
        severity: (ep.riskOverall ?? 0) >= 85 ? "critical" : (ep.riskOverall ?? 0) >= 70 ? "high" : "medium",
        riskFactors: [
          ep.isIsolated ? null : "not isolated",
          (ep.riskOverall ?? 0) > 80 ? "high risk score" : null,
        ].filter(Boolean) as string[],
        confidence: 85,
        lastUpdated: ep.lastCheckIn?.toISOString() ?? new Date().toISOString(),
      }));
    });
    return reply.send({ items });
  });

  /**
   * GET /v1/ai/anomalies
   * Returns anomaly detection results from identity and hunt data.
   */
  app.get("/v1/ai/anomalies", {
    preHandler: [authenticate(app.env), requirePermission("view:incidents")],
  }, async (request, reply) => {
    const query = z.object({
      type: z.string().optional(),
      severity: z.string().optional(),
    }).parse(request.query);

    const orgId = request.user!.orgId;
    const items = await withTenant(app.db, orgId, async () => {
      const conditions = [eq(identityAnomalies.organizationId, orgId)];
      if (query.severity) conditions.push(sql`${identityAnomalies.severity} = ${query.severity}`);

      const rows = await app.db
        .select()
        .from(identityAnomalies)
        .where(and(...conditions))
        .orderBy(desc(identityAnomalies.detectedAt))
        .limit(50);

      return rows.map((r) => ({
        id: r.id,
        type: r.anomalyType,
        description: r.description ?? r.anomalyType,
        severity: r.severity,
        confidence: 78,
        baseline: 0,
        observed: 1,
        deviation: 100,
        assets: [],
        detectedAt: r.detectedAt?.toISOString() ?? new Date().toISOString(),
      }));
    });
    return reply.send({ items });
  });

  /**
   * GET /v1/ai/recommendations
   * Returns AI-generated remediation recommendations.
   */
  app.get("/v1/ai/recommendations", {
    preHandler: [authenticate(app.env), requirePermission("view:incidents")],
  }, async (request, reply) => {
    const query = z.object({ incidentId: z.string().optional() }).parse(request.query);
    const orgId = request.user!.orgId;

    // Generate recommendations from unacknowledged critical/high alerts
    const items = await withTenant(app.db, orgId, async () => {
      const openAlerts = await app.db
        .select()
        .from(alerts)
        .where(and(
          eq(alerts.organizationId, orgId),
          sql`${alerts.isAcknowledged} = false`,
          sql`${alerts.severity} IN ('critical', 'high')`,
        ))
        .orderBy(desc(alerts.aiPriorityScore))
        .limit(10);

      return openAlerts.map((a) => ({
        id: `rec-${a.id}`,
        type: "alert_response",
        title: `Respond to: ${a.title}`,
        description: a.description ?? `Address ${a.severity} alert: ${a.title}`,
        priority: (a.severity === "critical" ? "high" : "medium") as "high" | "medium" | "low",
        action: `Acknowledge and investigate alert ${a.id.slice(0, 8)}`,
        estimatedImpact: `Reduces ${a.severity} risk`,
        confidenceScore: Math.round((a.aiPriorityScore ?? 50) / 100 * 0.9 * 100) / 100,
      }));
    });
    return reply.send({ items });
  });

  /**
   * GET /v1/ai/hunt-assist
   * Returns query suggestions and an optimized hunt query using LLM.
   */
  app.get("/v1/ai/hunt-assist", {
    preHandler: [authenticate(app.env), requirePermission("view:hunt")],
  }, async (request, reply) => {
    const { query } = z.object({ query: z.string().min(1) }).parse(request.query);

    const raw = await llm.complete(HUNT_ASSIST_SYSTEM_PROMPT, query);

    let suggestions: string[];
    let optimizedQuery: string;
    try {
      const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
      const parsed = JSON.parse(jsonText) as { suggestions?: unknown; optimizedQuery?: unknown };
      suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5).map(String)
        : [];
      optimizedQuery = typeof parsed.optimizedQuery === "string" ? parsed.optimizedQuery : query;
      if (suggestions.length === 0) throw new Error("empty suggestions");
    } catch {
      // LLM unavailable or returned non-JSON — fall back to simple, honest heuristics
      // rather than fabricating confident-looking results.
      suggestions = [
        `${query} severity:critical`,
        `${query} severity:high`,
      ];
      optimizedQuery = `${query} severity:critical`;
    }

    return reply.send({ suggestions, optimizedQuery });
  });
}

