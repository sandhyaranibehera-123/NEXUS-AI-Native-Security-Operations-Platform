import { eq, and } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { attackGraphs, attackGraphNodes, attackGraphEdges } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";

export class AttackGraphService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const graphs = await this.db
        .select()
        .from(attackGraphs)
        .where(eq(attackGraphs.organizationId, orgId));

      return Promise.all(graphs.map(async (g) => this.getGraphDetail(g.id, orgId)));
    });
  }

  async getGraphDetail(graphId: string, orgId: string) {
    return withTenant(this.client, orgId, async () => {
      const [graph] = await this.db
        .select()
        .from(attackGraphs)
        .where(and(eq(attackGraphs.id, graphId), eq(attackGraphs.organizationId, orgId)))
        .limit(1);

      if (!graph) return null;

      const nodes = await this.db
        .select()
        .from(attackGraphNodes)
        .where(eq(attackGraphNodes.graphId, graphId));

      const edges = await this.db
        .select()
        .from(attackGraphEdges)
        .where(eq(attackGraphEdges.graphId, graphId));

      return {
        id: graph.id,
        name: graph.name,
        description: graph.description,
        incidentId: graph.incidentId,
        generatedAt: graph.generatedAt?.toISOString(),
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.nodeType,
          label: n.label,
          compromised: n.isCompromised,
          entryPoint: n.isEntryPoint,
          target: n.isTarget,
          riskScore: n.riskScore,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          relationship: e.relationshipType,
          mitre: e.mitreTechnique,
          active: e.isActivePath,
        })),
      };
    });
  }
}
