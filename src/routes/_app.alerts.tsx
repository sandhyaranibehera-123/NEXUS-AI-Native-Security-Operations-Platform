import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bell, BellRing, CheckCircle2, Clock, Filter } from "lucide-react";
import { ModulePreview } from "@/components/module-preview";

export const Route = createFileRoute("/_app/alerts")({
  head: () => ({ meta: [{ title: "Alerts — NEXUS" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  return (
    <ModulePreview
      icon={BellRing}
      eyebrow="Operate"
      title="Alerts"
      description="Real-time notification queue across detections, integrations, and automation pipelines."
      kpis={[
        { label: "Active", value: 1247, icon: Bell, tone: "critical", series: 80, delta: { v: "12%", up: true } },
        { label: "Acknowledged", value: 412, icon: CheckCircle2, tone: "healthy", series: 50 },
        { label: "Avg. ack time", value: "3m 12s", icon: Clock, tone: "info" },
        { label: "Suppressed", value: 89, icon: Filter, tone: "default" },
        { label: "SLA breaches", value: 7, icon: AlertTriangle, tone: "high" },
      ]}
      tableTitle="Open alert queue"
      columns={["Alert", "Source", "Owner", "Age", "State"]}
      rows={[
        { cells: ["EDR-2001 LSASS access on web-prod-12", "edr-falconlite", "soc-tier2", "00:04:21", "OPEN"], severity: "critical" },
        { cells: ["AUTH-220 Brute force from 185.220.x.x", "okta", "—", "00:08:02", "OPEN"], severity: "high" },
        { cells: ["CLOUD-IAM-9 Wildcard policy attached", "aws-cloudtrail", "cloud-ops", "00:11:55", "TRIAGE"], severity: "high" },
        { cells: ["DNS-77 DGA pattern from finance-laptop-08", "zeek", "soc-tier1", "00:21:30", "OPEN"], severity: "medium" },
        { cells: ["K8S-14 Privileged container in prod-payments", "k8s-audit", "platform", "00:34:12", "ACK"], severity: "medium" },
        { cells: ["EDR-1042 Office spawned powershell.exe", "edr-falconlite", "soc-tier1", "01:02:48", "ACK"], severity: "high" },
        { cells: ["GH-AUDIT-3 New deploy key on infra/terraform", "github-audit", "secops", "02:14:00", "OPEN"], severity: "info" },
      ]}
      rightPanel={{
        title: "By severity",
        items: [
          { label: "Critical", value: "42", tone: "critical" },
          { label: "High", value: "316", tone: "high" },
          { label: "Medium", value: "611" },
          { label: "Info", value: "278", tone: "info" },
          { label: "Healthy", value: "—", tone: "healthy" },
        ],
      }}
    />
  );
}
