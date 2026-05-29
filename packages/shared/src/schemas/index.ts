import { z } from "zod";
import {
  AlertStatusSchema,
  CopilotWorkflowSchema,
  EventTypeSchema,
  IncidentStatusSchema,
  RoleSchema,
  SeverityLevelSchema,
} from "../enums/index.js";

export const PaginationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
  organizationId: z.string().uuid(),
  workspace: z.string(),
  avatarSeed: z.string().optional(),
  permissions: z.array(z.string()),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const SecurityEventListQuerySchema = z.object({
  severity: z.array(SeverityLevelSchema).optional(),
  type: z.array(EventTypeSchema).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  since: z.string().datetime().optional(),
  search: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type SecurityEventListQuery = z.infer<typeof SecurityEventListQuerySchema>;

export const SecurityEventDtoSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  type: EventTypeSchema,
  severity: SeverityLevelSchema,
  source: z.string(),
  sourceIp: z.string().nullable(),
  destIp: z.string().nullable(),
  user: z.string().nullable(),
  host: z.string().nullable(),
  rule: z.string().nullable(),
  message: z.string(),
  country: z.string().nullable(),
  asset: z.string().nullable(),
  mitre: z.string().nullable(),
  raw: z.record(z.unknown()).optional(),
});
export type SecurityEventDto = z.infer<typeof SecurityEventDtoSchema>;

export const IncidentListQuerySchema = z.object({
  status: z.array(IncidentStatusSchema).optional(),
  severity: z.array(SeverityLevelSchema).optional(),
  search: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type IncidentListQuery = z.infer<typeof IncidentListQuerySchema>;

export const IncidentDtoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  severity: SeverityLevelSchema,
  status: IncidentStatusSchema,
  assignee: z.string().nullable(),
  openedAt: z.string(),
  updatedAt: z.string(),
  affectedAssets: z.number(),
  affectedUsers: z.number(),
  category: z.string().nullable(),
  mitre: z.array(z.string()),
  summary: z.string().nullable(),
  rca: z.string().nullable(),
  recommendations: z.array(z.string()),
  linkedEventIds: z.array(z.string()),
  timeline: z.array(z.object({
    at: z.string(),
    actor: z.string(),
    action: z.string(),
    detail: z.string().optional(),
  })),
});
export type IncidentDto = z.infer<typeof IncidentDtoSchema>;

export const UpdateIncidentStatusSchema = z.object({
  status: IncidentStatusSchema,
});
export type UpdateIncidentStatus = z.infer<typeof UpdateIncidentStatusSchema>;

export const AlertListQuerySchema = z.object({
  severity: z.array(SeverityLevelSchema).optional(),
  status: z.array(AlertStatusSchema).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AlertListQuery = z.infer<typeof AlertListQuerySchema>;

export const AlertDtoSchema = z.object({
  id: z.string().uuid(),
  rule: z.string(),
  severity: SeverityLevelSchema,
  source: z.string(),
  owner: z.string().nullable(),
  aiPriorityScore: z.number(),
  dedupCount: z.number(),
  escalated: z.boolean(),
  acknowledged: z.boolean(),
  suppressed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  description: z.string().nullable(),
  raw: z.record(z.unknown()).optional(),
});
export type AlertDto = z.infer<typeof AlertDtoSchema>;

export const CopilotSessionCreateSchema = z.object({
  workflowType: CopilotWorkflowSchema.optional(),
  incidentId: z.string().uuid().optional(),
  title: z.string().optional(),
});
export type CopilotSessionCreate = z.infer<typeof CopilotSessionCreateSchema>;

export const CopilotMessageCreateSchema = z.object({
  content: z.string().min(1).max(8000),
  workflowType: CopilotWorkflowSchema.optional(),
});
export type CopilotMessageCreate = z.infer<typeof CopilotMessageCreateSchema>;

export const DashboardStatsSchema = z.object({
  openIncidents: z.number(),
  criticalAlerts: z.number(),
  eventsLast24h: z.number(),
  meanTimeToDetect: z.number(),
  endpointsAtRisk: z.number(),
  complianceScore: z.number(),
});
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().uuid().nullable(),
    total: z.number().optional(),
  });
