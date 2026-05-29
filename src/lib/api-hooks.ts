import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api-client";
import type {
  SecurityEventDto,
  IncidentDto,
  AlertDto,
  DashboardStats,
  SecurityEventListQuery,
  IncidentListQuery,
  AlertListQuery,
} from "@nexus/shared";

const defaultQueryOpts = { staleTime: 15_000, retry: 1 };

function buildParams(params: Record<string, string | number | undefined>, arrays?: Record<string, string[]>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, String(v));
  }
  if (arrays) {
    for (const [k, vals] of Object.entries(arrays)) {
      vals?.forEach((v) => sp.append(k, v));
    }
  }
  return sp.toString();
}

export function useEvents(filters: Partial<SecurityEventListQuery> = {}) {
  const qs = buildParams(
    { limit: filters.limit, search: filters.search, since: filters.since },
    { severity: filters.severity },
  );
  return useQuery({
    queryKey: ["events", filters],
    queryFn: () => apiFetch<{ items: SecurityEventDto[]; nextCursor: string | null }>(`/v1/events?${qs}`),
    ...defaultQueryOpts,
  });
}

export function useIncidents(filters: Partial<IncidentListQuery> = {}) {
  const qs = buildParams(
    { limit: filters.limit, search: filters.search },
    { status: filters.status, severity: filters.severity },
  );
  return useQuery({
    queryKey: ["incidents", filters],
    queryFn: () => apiFetch<{ items: IncidentDto[]; nextCursor: string | null }>(`/v1/incidents?${qs}`),
    ...defaultQueryOpts,
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: ["incident", id],
    queryFn: () => apiFetch<IncidentDto>(`/v1/incidents/${id}`),
    enabled: !!id,
    ...defaultQueryOpts,
  });
}

export function useUpdateIncidentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<IncidentDto>(`/v1/incidents/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["incident", id] });
    },
  });
}

export function useAlerts(filters: Partial<AlertListQuery> = {}) {
  const qs = buildParams(
    { limit: filters.limit },
    { severity: filters.severity, status: filters.status },
  );
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => apiFetch<{ items: AlertDto[]; nextCursor: string | null }>(`/v1/alerts?${qs}`),
    ...defaultQueryOpts,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AlertDto>(`/v1/alerts/${id}/acknowledge`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => apiFetch<DashboardStats>("/v1/dashboard/stats"),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: () =>
      apiFetch<{ items: { id: string; label: string; title: string; type: string }[] }>(
        `/v1/search?q=${encodeURIComponent(q)}`,
      ),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });
}

export function useEndpoints(search?: string) {
  return useQuery({
    queryKey: ["endpoints", search],
    queryFn: () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      return apiFetch<{ items: EndpointApi[] }>(`/v1/endpoints${qs}`);
    },
    ...defaultQueryOpts,
  });
}

export function useVulnerabilities(search?: string) {
  return useQuery({
    queryKey: ["vulnerabilities", search],
    queryFn: () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      return apiFetch<{ items: VulnerabilityApi[] }>(`/v1/vulnerabilities${qs}`);
    },
    ...defaultQueryOpts,
  });
}

export function useThreatActors(search?: string) {
  return useQuery({
    queryKey: ["threat-actors", search],
    queryFn: () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      return apiFetch<{ items: ThreatActorApi[] }>(`/v1/threat-intel/actors${qs}`);
    },
    ...defaultQueryOpts,
  });
}

export function useThreatIocs() {
  return useQuery({
    queryKey: ["threat-iocs"],
    queryFn: () => apiFetch<{ items: IocApi[] }>("/v1/threat-intel/iocs"),
    ...defaultQueryOpts,
  });
}

export function useCloudSummary() {
  return useQuery({
    queryKey: ["cloud", "summary"],
    queryFn: () => apiFetch<CloudSummaryApi>("/v1/cloud/summary"),
    ...defaultQueryOpts,
  });
}

export function useNetworkFlows() {
  return useQuery({
    queryKey: ["network", "flows"],
    queryFn: () => apiFetch<{ items: NetworkFlowApi[] }>("/v1/network/flows"),
    ...defaultQueryOpts,
  });
}

export function useDnsQueries() {
  return useQuery({
    queryKey: ["network", "dns"],
    queryFn: () => apiFetch<{ items: DnsQueryApi[] }>("/v1/network/dns"),
    ...defaultQueryOpts,
  });
}

export function useKnowledge(search?: string) {
  return useQuery({
    queryKey: ["knowledge", search],
    queryFn: () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      return apiFetch<{ items: KnowledgeArticleApi[] }>(`/v1/knowledge${qs}`);
    },
    ...defaultQueryOpts,
  });
}

export function useKnowledgeArticle(id: string) {
  return useQuery({
    queryKey: ["knowledge", id],
    queryFn: () => apiFetch<KnowledgeArticleDetailApi>(`/v1/knowledge/${id}`),
    enabled: !!id,
    ...defaultQueryOpts,
  });
}

export function useCases() {
  return useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<{ items: CaseApi[] }>("/v1/cases"),
    ...defaultQueryOpts,
  });
}

export function useInvestigations() {
  return useQuery({
    queryKey: ["investigations"],
    queryFn: () => apiFetch<{ items: InvestigationApi[] }>("/v1/investigations"),
    ...defaultQueryOpts,
  });
}

export function useCompliance() {
  return useQuery({
    queryKey: ["compliance"],
    queryFn: () => apiFetch<{ items: ComplianceAssessmentApi[] }>("/v1/compliance/assessments"),
    ...defaultQueryOpts,
  });
}

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => apiFetch<{ items: ReportApi[] }>("/v1/reports"),
    ...defaultQueryOpts,
  });
}

export function useRunbooks() {
  return useQuery({
    queryKey: ["runbooks"],
    queryFn: () => apiFetch<{ items: RunbookApi[] }>("/v1/runbooks"),
    ...defaultQueryOpts,
  });
}

export function useAttackGraphs() {
  return useQuery({
    queryKey: ["attack-graphs"],
    queryFn: () => apiFetch<{ items: AttackGraphApi[] }>("/v1/attack-graphs"),
    ...defaultQueryOpts,
  });
}

export function useAuditLog(search?: string) {
  return useQuery({
    queryKey: ["audit", search],
    queryFn: () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      return apiFetch<{ items: AuditLogApi[] }>(`/v1/audit${qs}`);
    },
    ...defaultQueryOpts,
  });
}

export function usePlatformHealth() {
  return useQuery({
    queryKey: ["platform-health"],
    queryFn: () => apiFetch<PlatformHealthApi>("/v1/health/platform"),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: () => apiFetch<{ items: IntegrationApi[] }>("/v1/integrations"),
    ...defaultQueryOpts,
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiFetch<{ items: ApiKeyApi[] }>("/v1/developer/api-keys"),
    ...defaultQueryOpts,
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ["webhooks"],
    queryFn: () => apiFetch<{ items: WebhookApi[] }>("/v1/developer/webhooks"),
    ...defaultQueryOpts,
  });
}

export function useApiNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      apiFetch<{
        items: {
          id: string;
          type: string;
          severity: string;
          title: string;
          body: string | null;
          isRead: boolean;
          createdAt: string;
        }[];
      }>("/v1/notifications"),
    staleTime: 10_000,
    retry: 1,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/v1/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useCurrentOrg() {
  return useQuery({
    queryKey: ["org", "current"],
    queryFn: () => apiFetch<{ id: string; name: string; slug: string }>("/v1/orgs/current"),
    staleTime: 60_000,
  });
}

export function useIdentityAnomalies() {
  return useQuery({
    queryKey: ["identity-anomalies"],
    queryFn: () => apiFetch<{ items: IdentityAnomalyApi[] }>("/v1/users/identity-anomalies"),
    ...defaultQueryOpts,
  });
}

// API response types
export interface EndpointApi {
  id: string;
  hostname: string;
  os: string;
  osType: string;
  riskScore: number;
  status: string;
  isolated: boolean;
  ip: string | null;
  agentVersion: string;
  lastCheckIn: string;
}

export interface VulnerabilityApi {
  id: string;
  cve: string;
  cvss: number;
  epss: number;
  severity: string;
  patchStatus: string;
  exploitStatus: string;
  assetCount: number;
  description: string;
}

export interface ThreatActorApi {
  id: string;
  name: string;
  origin: string;
  motivation: string[];
  ttps: string[];
  aliases: string[];
  severity: string;
  lastSeen: string;
}

export interface IocApi {
  id: string;
  type: string;
  value: string;
  severity: string;
  confidence: number;
}

export interface CloudSummaryApi {
  accountCount: number;
  totalAssets: number;
  avgRisk: number;
  openFindings: number;
  accounts: unknown[];
}

export interface NetworkFlowApi {
  id: string;
  sourceIp: string;
  destinationIp: string;
  protocol: string | null;
  isMalicious: boolean;
  flowStart: string;
}

export interface DnsQueryApi {
  id: string;
  domain: string;
  isDga: boolean;
  isBlocklisted: boolean;
  queriedAt: string;
}

export interface KnowledgeArticleApi {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  tags: string[];
  updatedAt: string;
}

export interface KnowledgeArticleDetailApi extends KnowledgeArticleApi {
  content: string;
}

export interface CaseApi {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  priority: string;
  owner: string;
}

export interface InvestigationApi {
  id: string;
  title: string;
  content: string | null;
  updatedAt: string;
}

export interface ComplianceAssessmentApi {
  id: string;
  framework: string;
  name: string;
  scorePercent: number;
  status: string;
  controls: { id: string; controlId: string; title: string; status: string }[];
}

export interface ReportApi {
  id: string;
  title: string;
  reportType: string;
  status: string;
  generatedAt: string | null;
}

export interface RunbookApi {
  id: string;
  name: string;
  description: string | null;
  isAutomated: boolean;
  steps: { name: string; actionType: string }[];
}

export interface AttackGraphApi {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
}

export interface AuditLogApi {
  id: string;
  actor: string;
  action: string;
  resourceType: string | null;
  timestamp: string;
}

export interface PlatformHealthApi {
  overall: string;
  services: { name: string; status: string; latencyMs: number | null }[];
  uptime: string;
}

export interface IntegrationApi {
  id: string;
  provider: string;
  displayName: string;
  status: string;
  eventsIngested: number;
}

export interface ApiKeyApi {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: unknown;
  isActive: boolean;
}

export interface WebhookApi {
  id: string;
  name: string;
  endpointUrl: string;
  isActive: boolean;
}

export interface IdentityAnomalyApi {
  id: string;
  userEmail: string;
  type: string;
  severity: string;
  description: string | null;
}
