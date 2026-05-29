import {
  pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, numeric,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  industry: varchar("industry", { length: 100 }),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  permissions: jsonb("permissions").notNull().default([]),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  roleId: uuid("role_id").references(() => roles.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  avatarSeed: varchar("avatar_seed", { length: 255 }),
  workspaceName: varchar("workspace_name", { length: 255 }),
  status: varchar("status", { length: 50 }).default("active"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  refreshToken: varchar("refresh_token", { length: 512 }).notNull().unique(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  isRevoked: boolean("is_revoked").default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const securityEvents = pgTable("security_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  eventTimestamp: timestamp("event_timestamp", { withTimezone: true }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  source: varchar("source", { length: 255 }).notNull(),
  sourceIp: varchar("source_ip", { length: 45 }),
  destIp: varchar("dest_ip", { length: 45 }),
  username: varchar("username", { length: 255 }),
  host: varchar("host", { length: 255 }),
  ruleName: varchar("rule_name", { length: 255 }),
  message: text("message").notNull(),
  countryCode: varchar("country_code", { length: 2 }),
  asset: varchar("asset", { length: 255 }),
  mitreTechnique: varchar("mitre_technique", { length: 100 }),
  rawData: jsonb("raw_data").default({}),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("new"),
  aiPriorityScore: integer("ai_priority_score").default(0),
  dedupCount: integer("dedup_count").default(1),
  isEscalated: boolean("is_escalated").default(false),
  isAcknowledged: boolean("is_acknowledged").default(false),
  isSuppressed: boolean("is_suppressed").default(false),
  rawTriggerData: jsonb("raw_trigger_data").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  incidentCode: varchar("incident_code", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("open"),
  leadInvestigatorId: uuid("lead_investigator_id"),
  category: varchar("category", { length: 100 }),
  affectedAssetsCount: integer("affected_assets_count").default(0),
  affectedUsersCount: integer("affected_users_count").default(0),
  summary: text("summary"),
  rootCauseAnalysis: text("root_cause_analysis"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const incidentTimeline = pgTable("incident_timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  actorType: varchar("actor_type", { length: 20 }).default("user"),
  actorName: varchar("actor_name", { length: 255 }),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  description: text("description").notNull(),
});

export const incidentRecommendations = pgTable("incident_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id),
  content: text("content").notNull(),
  isCompleted: boolean("is_completed").default(false),
  orderIndex: integer("order_index").default(0),
});

export const copilotSessions = pgTable("copilot_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }),
  workflowType: varchar("workflow_type", { length: 50 }),
  incidentId: uuid("incident_id"),
  messageCount: integer("message_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const copilotMessages = pgTable("copilot_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => copilotSessions.id),
  senderRole: varchar("sender_role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  modelUsed: varchar("model_used", { length: 100 }),
  promptTokens: integer("prompt_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const knowledgeArticles = pgTable("knowledge_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 100 }),
  tags: jsonb("tags").default([]),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id),
  type: varchar("type", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).default("info"),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id"),
  userEmail: varchar("user_email", { length: 255 }),
  action: varchar("action", { length: 255 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: uuid("resource_id"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

export const endpoints = pgTable("endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  os: varchar("os", { length: 20 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  isIsolated: boolean("is_isolated").default(false),
  riskOverall: integer("risk_overall").default(0),
  riskMalware: integer("risk_malware").default(0),
  riskNetwork: integer("risk_network").default(0),
  riskCredential: integer("risk_credential").default(0),
  riskBehavior: integer("risk_behavior").default(0),
  sessionCount: integer("session_count").default(0),
  tags: jsonb("tags").default([]),
  agentVersion: varchar("agent_version", { length: 50 }),
  lastCheckIn: timestamp("last_check_in", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("healthy"),
  osVersion: varchar("os_version", { length: 100 }),
});

export const endpointMalwareIndicators = pgTable("endpoint_malware_indicators", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpointId: uuid("endpoint_id").notNull().references(() => endpoints.id),
  indicatorType: varchar("indicator_type", { length: 50 }).notNull(),
  indicator: text("indicator").notNull(),
  severity: varchar("severity", { length: 20 }).default("high"),
  description: text("description"),
  quarantined: boolean("quarantined").default(false),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
});

export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  caseNumber: varchar("case_number", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  ownerId: uuid("owner_id"),
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const investigationNotebooks = pgTable("investigation_notebooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  caseId: uuid("case_id"),
  incidentId: uuid("incident_id"),
  authorId: uuid("author_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const vulnerabilities = pgTable("vulnerabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  cveId: varchar("cve_id", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  cvssScore: numeric("cvss_score", { precision: 3, scale: 1 }),
  epssScore: numeric("epss_score", { precision: 5, scale: 4 }),
  severity: varchar("severity", { length: 20 }).notNull(),
  patchStatus: varchar("patch_status", { length: 30 }).default("unpatched"),
  exploitStatus: varchar("exploit_status", { length: 30 }).default("none"),
  affectedPackages: jsonb("affected_packages").default([]),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const assetVulnerabilities = pgTable("asset_vulnerabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  vulnerabilityId: uuid("vulnerability_id").notNull().references(() => vulnerabilities.id),
  assetId: uuid("asset_id").notNull(),
  assetType: varchar("asset_type", { length: 20 }).notNull(),
  status: varchar("status", { length: 50 }).default("open"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow(),
});

export const threatActors = pgTable("threat_actors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  aliases: jsonb("aliases").default([]),
  originType: varchar("origin_type", { length: 50 }).default("unknown"),
  description: text("description"),
  motivation: jsonb("motivation").default([]),
  ttps: jsonb("ttps").default([]),
  linkedCampaigns: jsonb("linked_campaigns").default([]),
  severity: varchar("severity", { length: 20 }).default("high"),
  isActive: boolean("is_active").default(true),
  firstSeen: timestamp("first_seen", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const threatActorTimeline = pgTable("threat_actor_timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull().references(() => threatActors.id),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  eventTitle: varchar("event_title", { length: 255 }).notNull(),
  eventDesc: text("event_desc"),
});

export const iocs = pgTable("iocs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  threatActorId: uuid("threat_actor_id").references(() => threatActors.id),
  iocType: varchar("ioc_type", { length: 50 }).notNull(),
  value: text("value").notNull(),
  context: text("context"),
  confidenceScore: integer("confidence_score").default(80),
  severity: varchar("severity", { length: 20 }).default("high"),
  isActive: boolean("is_active").default(true),
  firstSeen: timestamp("first_seen", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const cloudAccounts = pgTable("cloud_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  provider: varchar("provider", { length: 50 }).notNull(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  accountAlias: varchar("account_alias", { length: 255 }),
  regions: jsonb("regions").default([]),
  syncStatus: varchar("sync_status", { length: 50 }).default("healthy"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  totalAssets: integer("total_assets").default(0),
  riskScore: integer("risk_score").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const cloudAssets = pgTable("cloud_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  cloudAccountId: uuid("cloud_account_id").notNull().references(() => cloudAccounts.id),
  assetType: varchar("asset_type", { length: 100 }).notNull(),
  assetId: varchar("asset_id", { length: 255 }).notNull(),
  assetName: varchar("asset_name", { length: 255 }),
  region: varchar("region", { length: 50 }),
  isPublic: boolean("is_public").default(false),
  riskScore: integer("risk_score").default(0),
  configuration: jsonb("configuration").default({}),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow(),
});

export const cloudIamFindings = pgTable("cloud_iam_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  cloudAccountId: uuid("cloud_account_id").notNull().references(() => cloudAccounts.id),
  principalName: varchar("principal_name", { length: 255 }),
  findingType: varchar("finding_type", { length: 100 }).notNull(),
  riskLevel: varchar("risk_level", { length: 20 }).notNull(),
  description: text("description"),
  isResolved: boolean("is_resolved").default(false),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
});

export const networkFlows = pgTable("network_flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  sourceIp: varchar("source_ip", { length: 45 }).notNull(),
  destinationIp: varchar("destination_ip", { length: 45 }).notNull(),
  sourcePort: integer("source_port"),
  destinationPort: integer("destination_port"),
  protocol: varchar("protocol", { length: 20 }),
  bytesTotal: integer("bytes_total").default(0),
  isMalicious: boolean("is_malicious").default(false),
  threatCategory: varchar("threat_category", { length: 100 }),
  geoCountrySrc: varchar("geo_country_src", { length: 2 }),
  geoCountryDst: varchar("geo_country_dst", { length: 2 }),
  flowStart: timestamp("flow_start", { withTimezone: true }).notNull(),
});

export const dnsQueries = pgTable("dns_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  queryDomain: varchar("query_domain", { length: 512 }).notNull(),
  queryType: varchar("query_type", { length: 10 }).notNull(),
  entropyScore: numeric("entropy_score", { precision: 5, scale: 3 }),
  isDga: boolean("is_dga").default(false),
  isBlocklisted: boolean("is_blocklisted").default(false),
  threatCategory: varchar("threat_category", { length: 100 }),
  queriedAt: timestamp("queried_at", { withTimezone: true }).defaultNow(),
});

export const attackGraphs = pgTable("attack_graphs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  incidentId: uuid("incident_id"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

export const attackGraphNodes = pgTable("attack_graph_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphId: uuid("graph_id").notNull().references(() => attackGraphs.id),
  nodeType: varchar("node_type", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  isCompromised: boolean("is_compromised").default(false),
  isEntryPoint: boolean("is_entry_point").default(false),
  isTarget: boolean("is_target").default(false),
  riskScore: integer("risk_score").default(0),
  metadata: jsonb("metadata").default({}),
});

export const attackGraphEdges = pgTable("attack_graph_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphId: uuid("graph_id").notNull().references(() => attackGraphs.id),
  sourceNodeId: uuid("source_node_id").notNull(),
  targetNodeId: uuid("target_node_id").notNull(),
  relationshipType: varchar("relationship_type", { length: 100 }).notNull(),
  mitreTechnique: varchar("mitre_technique", { length: 50 }),
  isActivePath: boolean("is_active_path").default(false),
  confidenceScore: integer("confidence_score").default(80),
});

export const runbooks = pgTable("runbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  isAutomated: boolean("is_automated").default(false),
  isEnabled: boolean("is_enabled").default(true),
  executionCount: integer("execution_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const runbookSteps = pgTable("runbook_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runbookId: uuid("runbook_id").notNull().references(() => runbooks.id),
  stepOrder: integer("step_order").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  actionPayload: jsonb("action_payload").default({}),
  isManual: boolean("is_manual").default(false),
});

export const complianceAssessments = pgTable("compliance_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  framework: varchar("framework", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  totalControls: integer("total_controls").default(0),
  passedControls: integer("passed_controls").default(0),
  scorePercent: numeric("score_percent", { precision: 5, scale: 2 }),
  status: varchar("status", { length: 50 }).default("in_progress"),
  assessedAt: timestamp("assessed_at", { withTimezone: true }).defaultNow(),
});

export const complianceControls = pgTable("compliance_controls", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => complianceAssessments.id),
  controlId: varchar("control_id", { length: 50 }).notNull(),
  controlTitle: varchar("control_title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("not_started"),
  dueDate: timestamp("due_date", { withTimezone: true }),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  reportType: varchar("report_type", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  parameters: jsonb("parameters").default({}),
  storageUri: text("storage_uri"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  scopes: jsonb("scopes").default([]),
  rateLimitRpm: integer("rate_limit_rpm").default(1000),
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  secretKey: varchar("secret_key", { length: 255 }).notNull(),
  subscribedEvents: jsonb("subscribed_events").default([]),
  isActive: boolean("is_active").default(true),
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const platformIntegrations = pgTable("platform_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  provider: varchar("provider", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending"),
  syncEnabled: boolean("sync_enabled").default(true),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastError: text("last_error"),
  eventsIngested: integer("events_ingested").default(0),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const platformHealthChecks = pgTable("platform_health_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceName: varchar("service_name", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).default("healthy"),
  latencyMs: integer("latency_ms"),
  errorMsg: text("error_msg"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow(),
});

export const identityAnomalies = pgTable("identity_anomalies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  anomalyType: varchar("anomaly_type", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  description: text("description"),
  isResolved: boolean("is_resolved").default(false),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
});
