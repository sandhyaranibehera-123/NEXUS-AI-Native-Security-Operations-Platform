export type Severity = "critical" | "high" | "medium" | "low" | "info" | "healthy";

export type EventType =
  | "failed_login"
  | "malware_detection"
  | "suspicious_process"
  | "dns_anomaly"
  | "privilege_escalation"
  | "suspicious_api"
  | "iam_change"
  | "data_exfiltration"
  | "brute_force"
  | "ransomware";

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: EventType;
  severity: Severity;
  source: string;
  sourceIp: string;
  destIp: string;
  user: string;
  host: string;
  rule: string;
  message: string;
  country: string;
  asset: string;
  mitre: string;
  raw: Record<string, unknown>;
}

export type IncidentStatus = "open" | "investigating" | "contained" | "eradicated" | "recovered" | "closed" | "resolved";

export interface Incident {
  id: string;
  code: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  assignee: string;
  openedAt: string;
  updatedAt: string;
  affectedAssets: number;
  affectedUsers: number;
  category: string;
  mitre: string[];
  summary: string;
  timeline: { at: string; actor: string; action: string; detail?: string }[];
  rca: string;
  recommendations: string[];
  linkedEventIds: string[];
}

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Alert {
  id: string;
  rule: string;
  severity: AlertSeverity;
  source: string;
  owner: string | null;
  aiPriorityScore: number;
  dedupCount: number;
  escalated: boolean;
  acknowledged: boolean;
  suppressed: boolean;
  createdAt: string;
  updatedAt: string;
  description: string;
  raw: Record<string, unknown>;
}

export type EndpointOS = "windows" | "linux" | "macos";

export interface RiskScoreBreakdown {
  overall: number;
  malware: number;
  network: number;
  credential: number;
  behavior: number;
}

export interface Endpoint {
  id: string;
  hostname: string;
  os: EndpointOS;
  riskScore: RiskScoreBreakdown;
  agentVersion: string;
  lastCheckIn: string;
  isolated: boolean;
  malwareIndicators: string[];
  sessionCount: number;
  ip: string;
  tags: string[];
}

export type PatchStatus = "unpatched" | "patch_available" | "patched";
export type ExploitStatus = "none" | "poc" | "active" | "weaponized";

export interface Vulnerability {
  id: string;
  cve: string;
  cvss: number;
  epss: number;
  affectedPackages: string[];
  assetCount: number;
  patchStatus: PatchStatus;
  exploitStatus: ExploitStatus;
  severity: Severity;
  publishedAt: string;
  description: string;
}

export type ActorOrigin = "nation_state" | "criminal" | "hacktivist" | "insider" | "unknown";

export interface ThreatActor {
  id: string;
  name: string;
  origin: ActorOrigin;
  motivation: string[];
  ttps: string[];
  aliases: string[];
  activityTimeline: { date: string; event: string }[];
  linkedCampaigns: string[];
  lastSeen: string;
  severity: Severity;
}

export interface MetricPoint { t: number; v: number; }
