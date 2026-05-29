import { eq, and, desc } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { copilotSessions, copilotMessages } from "@nexus/db/schema";
import type postgres from "postgres";
import type { CopilotSessionCreate, CopilotWorkflow } from "@nexus/shared";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";
import { RagService } from "./rag.service.js";
import { LlmAdapter } from "./llm.adapter.js";
import type { Env } from "../../config/env.js";

export class CopilotService {
  private rag: RagService;
  private llm: LlmAdapter;

  constructor(
    private db: DbClient,
    private client: postgres.Sql,
    env: Env,
  ) {
    this.rag = new RagService(db, client);
    this.llm = new LlmAdapter(env);
  }

  async createSession(orgId: string, userId: string, body: CopilotSessionCreate) {
    return withTenant(this.client, orgId, async () => {
      const [session] = await this.db.insert(copilotSessions).values({
        organizationId: orgId,
        userId,
        title: body.title ?? "New Copilot Session",
        workflowType: body.workflowType,
        incidentId: body.incidentId,
      }).returning();
      return session;
    });
  }

  async listSessions(orgId: string, userId: string) {
    return withTenant(this.client, orgId, async () => {
      return this.db
        .select()
        .from(copilotSessions)
        .where(and(eq(copilotSessions.organizationId, orgId), eq(copilotSessions.userId, userId)))
        .orderBy(desc(copilotSessions.updatedAt))
        .limit(20);
    });
  }

  async getMessages(orgId: string, sessionId: string) {
    return withTenant(this.client, orgId, async () => {
      const [session] = await this.db
        .select()
        .from(copilotSessions)
        .where(and(eq(copilotSessions.id, sessionId), eq(copilotSessions.organizationId, orgId)))
        .limit(1);
      if (!session) throw new NotFoundError("Session not found");

      return this.db
        .select()
        .from(copilotMessages)
        .where(eq(copilotMessages.sessionId, sessionId))
        .orderBy(copilotMessages.createdAt);
    });
  }

  async *streamMessage(
    orgId: string,
    userId: string,
    sessionId: string,
    content: string,
    workflowType?: CopilotWorkflow,
  ) {
    const start = Date.now();
    await withTenant(this.client, orgId, async () => {
      const [session] = await this.db
        .select()
        .from(copilotSessions)
        .where(and(eq(copilotSessions.id, sessionId), eq(copilotSessions.organizationId, orgId)))
        .limit(1);
      if (!session) throw new NotFoundError("Session not found");

      await this.db.insert(copilotMessages).values({
        sessionId,
        senderRole: "user",
        content,
      });
    });

    const context = await this.rag.retrieveContext(orgId, content);
    const workflow = workflowType ?? ("default" as CopilotWorkflow);
    let fullResponse = "";
    let modelUsed = "nexus-analyst-v3";
    let tokens = { prompt: 0, output: 0 };

    for await (const chunk of this.llm.streamChat(workflow, content, context)) {
      if (chunk.token) {
        fullResponse += chunk.token;
        yield { type: "token" as const, data: chunk.token };
      }
      if (chunk.done) {
        modelUsed = chunk.model ?? modelUsed;
        tokens = chunk.tokens ?? tokens;
      }
    }

    await withTenant(this.client, orgId, async () => {
      await this.db.insert(copilotMessages).values({
        sessionId,
        senderRole: "assistant",
        content: fullResponse,
        modelUsed,
        promptTokens: tokens.prompt,
        outputTokens: tokens.output,
        latencyMs: Date.now() - start,
      });

      await this.db
        .update(copilotSessions)
        .set({
          messageCount: (await this.db.select().from(copilotMessages).where(eq(copilotMessages.sessionId, sessionId))).length,
          updatedAt: new Date(),
        })
        .where(eq(copilotSessions.id, sessionId));
    });

    yield { type: "done" as const, data: { model: modelUsed, latencyMs: Date.now() - start } };
  }
}
