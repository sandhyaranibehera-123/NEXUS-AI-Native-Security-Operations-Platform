import { z } from "zod";

export const SeverityLevelSchema = z.enum([
  "critical", "high", "medium", "low", "info", "healthy",
]);
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;

export const EventTypeSchema = z.enum([
  "failed_login", "malware_detection", "suspicious_process", "dns_anomaly",
  "privilege_escalation", "suspicious_api", "iam_change", "data_exfiltration",
  "brute_force", "ransomware", "lateral_movement", "c2_communication",
  "credential_dump", "defense_evasion", "reconnaissance",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const IncidentStatusSchema = z.enum([
  "open", "investigating", "contained", "eradicated", "recovered", "closed",
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const AlertStatusSchema = z.enum([
  "new", "triaging", "acknowledged", "escalated", "suppressed", "resolved",
]);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;

export const EndpointOsSchema = z.enum([
  "windows", "linux", "macos", "ios", "android", "chromeos", "other",
]);
export type EndpointOs = z.infer<typeof EndpointOsSchema>;

export const CopilotWorkflowSchema = z.enum([
  "incident_explanation", "remediation_plan", "anomaly_clustering",
  "threat_prioritization", "attack_chain_analysis", "query_generation",
  "investigation_assistant", "report_generation",
]);
export type CopilotWorkflow = z.infer<typeof CopilotWorkflowSchema>;

export const RoleSchema = z.enum([
  "super_admin", "security_admin", "soc_analyst", "threat_hunter",
  "incident_responder", "compliance_officer", "viewer",
]);
export type Role = z.infer<typeof RoleSchema>;

export const ActorOriginSchema = z.enum([
  "nation_state", "criminal", "hacktivist", "insider", "competitor", "unknown",
]);
export type ActorOrigin = z.infer<typeof ActorOriginSchema>;

export const PatchStatusSchema = z.enum([
  "unpatched", "patch_available", "patched", "exception", "not_applicable",
]);
export type PatchStatus = z.infer<typeof PatchStatusSchema>;

export const ExploitStatusSchema = z.enum([
  "none", "poc", "active", "weaponized", "in_the_wild",
]);
export type ExploitStatus = z.infer<typeof ExploitStatusSchema>;
