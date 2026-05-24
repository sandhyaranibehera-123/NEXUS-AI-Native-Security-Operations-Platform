import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { MetricCard } from "@/components/metric-card";
import { makeMetricSeries } from "@/lib/mock/generators";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { Shield, Bell, Key, Laptop, Database, Bot, TriangleAlert as AlertTriangle, Clock, CircleCheck as CheckCircle2, Circle as XCircle, Eye } from "lucide-react";

export const Route = createFileRoute("/_app/policies")({
  head: () => ({ meta: [{ title: "Policies — NEXUS" }] }),
  component: PoliciesPage,

});

interface Policy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: "critical" | "high" | "medium" | "info";
  lastTriggered?: Date;
  violations?: number;
}

const DETECTION_POLICIES: Policy[] = [
  { id: "dp-1", name: "Cobalt Strike Detection", description: "Detect CS beacon patterns in network traffic and process execution", enabled: true, severity: "critical", lastTriggered: new Date(Date.now() - 180000), violations: 3 },
  { id: "dp-2", name: "Lateral Movement Detection", description: "SMB/WMI/PSExec from non-standard sources", enabled: true, severity: "high", lastTriggered: new Date(Date.now() - 2400000), violations: 7 },
  { id: "dp-3", name: "Data Exfiltration Detection", description: "Large outbound transfers exceeding baseline thresholds", enabled: true, severity: "high", lastTriggered: new Date(Date.now() - 7200000), violations: 2 },
  { id: "dp-4", name: "Ransomware Precursor Detection", description: "VSS delete, bcdedit, wbadmin disable patterns", enabled: true, severity: "critical", violations: 0 },
  { id: "dp-5", name: "Insider Threat Detection", description: "After-hours access, bulk downloads, USB insertion", enabled: false, severity: "high", lastTriggered: new Date(Date.now() - 86400000), violations: 5 },
];

const ALERT_POLICIES: Policy[] = [
  { id: "ap-1", name: "P1 Critical Escalation", description: "Auto-escalate critical alerts to SOC lead within 5 minutes", enabled: true, severity: "critical", lastTriggered: new Date(Date.now() - 300000), violations: 1 },
  { id: "ap-2", name: "Alert Suppression — Health Checks", description: "Suppress false positive alerts from health check endpoints", enabled: true, severity: "info", violations: 0 },
  { id: "ap-3", name: "Slack Notification — High Severity", description: "Post high-severity alerts to #soc-alerts Slack channel", enabled: true, severity: "high", lastTriggered: new Date(Date.now() - 600000), violations: 0 },
  { id: "ap-4", name: "PagerDuty — Critical Only", description: "Page on-call for critical severity alerts only", enabled: true, severity: "critical", violations: 0 },
];

const IAM_POLICIES: Policy[] = [
  { id: "ip-1", name: "No Wildcard Permissions", description: "Block IAM roles with s3:* or *:* resource access in production", enabled: true, severity: "high", lastTriggered: new Date(Date.now() - 3600000), violations: 2 },
  { id: "ip-2", name: "MFA Required for Admin", description: "Require MFA for all admin-level API operations", enabled: true, severity: "critical", violations: 0 },
  { id: "ip-3", name: "Cross-Account Access Review", description: "Flag cross-account IAM access for quarterly review", enabled: true, severity: "medium", lastTriggered: new Date(Date.now() - 86400000), violations: 4 },
  { id: "ip-4", name: "Service Account Key Rotation", description: "Enforce 90-day key rotation for service accounts", enabled: false, severity: "medium", violations: 8 },
];

const ENDPOINT_POLICIES: Policy[] = [
  { id: "ep-1", name: "USB Device Block", description: "Block unauthorized USB mass storage devices on production endpoints", enabled: true, severity: "high", lastTriggered: new Date(Date.now() - 43200000), violations: 3 },
  { id: "ep-2", name: "Agent Health Monitoring", description: "Alert when endpoint agent offline > 15 minutes", enabled: true, severity: "medium", lastTriggered: new Date(Date.now() - 7200000), violations: 1 },
  { id: "ep-3", name: "Disk Encryption Required", description: "Require BitLocker/FileVault on all managed endpoints", enabled: true, severity: "high", violations: 12 },
];

const RETENTION_POLICIES: Policy[] = [
  { id: "rp-1", name: "Event Retention — 90 Days", description: "Retain security events for 90 days, compress after 30", enabled: true, severity: "info", violations: 0 },
  { id: "rp-2", name: "Incident Data — 1 Year", description: "Retain incident records and evidence for 1 year for compliance", enabled: true, severity: "info", violations: 0 },
  { id: "rp-3", name: "Log Archival — 7 Years", description: "Archive raw logs to cold storage after 90 days, retain 7 years", enabled: true, severity: "info", violations: 0 },
];

const AI_POLICIES: Policy[] = [
  { id: "aip-1", name: "AI Data Scope Restriction", description: "Restrict AI processing to non-PII data fields only", enabled: true, severity: "high", violations: 0 },
  { id: "aip-2", name: "AI Output Review Required", description: "Critical AI recommendations require human review before action", enabled: true, severity: "high", lastTriggered: new Date(Date.now() - 14400000), violations: 1 },
  { id: "aip-3", name: "Model Version Gating", description: "Only approved AI model versions can run in production", enabled: true, severity: "medium", violations: 0 },
];

const VIOLATIONS = [
  { id: "v-1", policy: "No Wildcard Permissions", entity: "lambda-exec-role", severity: "high" as const, timestamp: new Date(Date.now() - 3600000) },
  { id: "v-2", policy: "USB Device Block", entity: "dev-workstation-05", severity: "high" as const, timestamp: new Date(Date.now() - 43200000) },
  { id: "v-3", policy: "Service Account Key Rotation", entity: "sa-data-pipeline", severity: "medium" as const, timestamp: new Date(Date.now() - 86400000) },
  { id: "v-4", policy: "Disk Encryption Required", entity: "12 endpoints", severity: "high" as const, timestamp: new Date(Date.now() - 172800000) },
  { id: "v-5", policy: "AI Output Review Required", entity: "AI-RCA-001", severity: "high" as const, timestamp: new Date(Date.now() - 14400000) },
];

const TAB_CONFIG = [
  { key: "detection", label: "Detection", icon: Shield, policies: DETECTION_POLICIES },
  { key: "alert", label: "Alert", icon: Bell, policies: ALERT_POLICIES },
  { key: "iam", label: "IAM", icon: Key, policies: IAM_POLICIES },
  { key: "endpoint", label: "Endpoint", icon: Laptop, policies: ENDPOINT_POLICIES },
  { key: "retention", label: "Retention", icon: Database, policies: RETENTION_POLICIES },
  { key: "ai", label: "AI Governance", icon: Bot, policies: AI_POLICIES },
];

function PolicyRow({ policy, onToggle }: { policy: Policy; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors">
      <Switch checked={policy.enabled} onCheckedChange={() => onToggle(policy.id)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", !policy.enabled && "text-muted-foreground")}>{policy.name}</span>
          <SeverityBadge severity={policy.severity} />
        </div>
        <p className={cn("text-xs mt-0.5", policy.enabled ? "text-muted-foreground" : "text-muted-foreground/60")}>{policy.description}</p>
      </div>
      <div className="shrink-0 text-right">
        {policy.violations !== undefined && policy.violations > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-high">
            <AlertTriangle className="h-3 w-3" />{policy.violations} violations
          </div>
        )}
        {policy.lastTriggered && (
          <div className="text-[10px] font-mono text-muted-foreground">
            {formatDistanceToNow(policy.lastTriggered, { addSuffix: true })}
          </div>
        )}
      </div>
    </div>
  );
}

function PoliciesPage() {
  const [policies, setPolicies] = useState<Record<string, Policy[]>>({
    detection: DETECTION_POLICIES,
    alert: ALERT_POLICIES,
    iam: IAM_POLICIES,
    endpoint: ENDPOINT_POLICIES,
    retention: RETENTION_POLICIES,
    ai: AI_POLICIES,
  });

  const togglePolicy = (tab: string, id: string) => {
    setPolicies((prev) => ({
      ...prev,
      [tab]: prev[tab].map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p),
    }));
  };

  const totalActive = Object.values(policies).flat().filter((p) => p.enabled).length;
  const totalViolations = Object.values(policies).flat().reduce((s, p) => s + (p.violations ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Policy Engine</h1>
        <p className="text-xs text-muted-foreground mt-1">Detection, governance, and compliance policies</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active Policies" value={String(totalActive)} icon={Shield} tone="default" series={makeMetricSeries(totalActive, 40)} />
        <MetricCard label="Violations/24h" value={String(totalViolations)} icon={AlertTriangle} tone="high" series={makeMetricSeries(totalViolations, 40)} />
        <MetricCard label="Coverage" value="94%" icon={CheckCircle2} tone="healthy" series={makeMetricSeries(94, 40)} />
        <MetricCard label="Avg Response" value="4.2m" icon={Clock} tone="info" series={makeMetricSeries(42, 40)} />
      </div>

      <Tabs defaultValue="detection">
        <TabsList className="flex-wrap">
          {TAB_CONFIG.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-xs">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_CONFIG.map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <div className="rounded-lg border border-border bg-surface/60 mt-4 divide-y divide-border">
              {policies[tab.key].map((p) => (
                <PolicyRow key={p.id} policy={p} onToggle={(id) => togglePolicy(tab.key, id)} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Recent Violations */}
      <div className="rounded-lg border border-border bg-surface/60">
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-high" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Recent Violations</span>
        </div>
        <div className="divide-y divide-border">
          {VIOLATIONS.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface transition-colors">
              <SeverityBadge severity={v.severity} />
              <div className="flex-1">
                <div className="text-sm">{v.policy}</div>
                <div className="text-xs text-muted-foreground">{v.entity}</div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{formatDistanceToNow(v.timestamp, { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
