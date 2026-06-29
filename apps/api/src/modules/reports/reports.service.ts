import { eq, and, desc, count, sql } from "drizzle-orm";
import type { DbClient } from "@nexus/db";
import { reports, alerts, incidents, vulnerabilities, scheduledReports } from "@nexus/db/schema";
import type postgres from "postgres";
import { withTenant } from "../../lib/tenant.js";
import { NotFoundError } from "../../lib/errors.js";

export class ReportsService {
  constructor(private db: DbClient, private client: postgres.Sql) {}

  async list(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(reports)
        .where(eq(reports.organizationId, orgId))
        .orderBy(desc(reports.createdAt))
        .limit(50);

      return rows.map((r) => ({
        id: r.id,
        reportType: r.reportType,
        title: r.title,
        status: r.status,
        storageUri: r.storageUri,
        generatedAt: r.generatedAt?.toISOString(),
        createdAt: r.createdAt?.toISOString(),
      }));
    });
  }

  async getById(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db
        .select()
        .from(reports)
        .where(and(eq(reports.id, id), eq(reports.organizationId, orgId)))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        reportType: row.reportType,
        title: row.title,
        status: row.status,
        storageUri: row.storageUri,
        generatedAt: row.generatedAt?.toISOString(),
        createdAt: row.createdAt?.toISOString(),
      };
    });
  }

  async generateCsv(orgId: string, report: { id: string; reportType: string; title: string }) {
    return withTenant(this.db, orgId, async () => {
      if (report.reportType === "alerts" || report.reportType === "alert_summary") {
        const rows = await this.db
          .select()
          .from(alerts)
          .where(eq(alerts.organizationId, orgId))
          .orderBy(desc(alerts.createdAt))
          .limit(500);
        const header = "id,title,severity,status,createdAt";
        const lines = rows.map((a) =>
          [a.id, `"${(a.title ?? "").replace(/"/g, '""')}"`, a.severity,
           a.status ?? (a.isAcknowledged ? "acknowledged" : "new"),
           a.createdAt?.toISOString() ?? ""].join(",")
        );
        return [header, ...lines].join("\n");
      }

      if (report.reportType === "incidents" || report.reportType === "incident_summary") {
        const rows = await this.db
          .select()
          .from(incidents)
          .where(eq(incidents.organizationId, orgId))
          .orderBy(desc(incidents.openedAt))
          .limit(500);
        const header = "id,code,title,severity,status,openedAt";
        const lines = rows.map((i) =>
          [i.id, i.incidentCode, `"${(i.title ?? "").replace(/"/g, '""')}"`, i.severity, i.status,
           i.openedAt?.toISOString() ?? ""].join(",")
        );
        return [header, ...lines].join("\n");
      }

      if (report.reportType === "dashboard" || report.reportType === "dashboard_summary" || report.reportType === "executive_summary") {
        const activeStatuses = ["open", "investigating", "contained"];
        const [activeIncidents] = await this.db
          .select({ value: count() })
          .from(incidents)
          .where(and(
            eq(incidents.organizationId, orgId),
            sql`${incidents.status} = ANY(${activeStatuses})`,
          ));
        const [criticalIncidents] = await this.db
          .select({ value: count() })
          .from(incidents)
          .where(and(
            eq(incidents.organizationId, orgId),
            eq(incidents.severity, "critical"),
          ));
        const [openAlerts] = await this.db
          .select({ value: count() })
          .from(alerts)
          .where(and(
            eq(alerts.organizationId, orgId),
            sql`${alerts.status} IN ('new', 'triaging', 'escalated')`,
          ));
        const [openVulns] = await this.db
          .select({ value: count() })
          .from(vulnerabilities)
          .where(sql`${vulnerabilities.patchStatus} <> 'patched'`);

        const header = "metric,value,generatedAt";
        const at = new Date().toISOString();
        const rows = [
          ["Active Incidents", activeIncidents?.value ?? 0],
          ["Critical Incidents", criticalIncidents?.value ?? 0],
          ["Open Alerts", openAlerts?.value ?? 0],
          ["Open Vulnerabilities", openVulns?.value ?? 0],
        ];
        return [header, ...rows.map(([m, v]) => `${m},${v},${at}`)].join("\n");
      }

      return `id,title,type,generatedAt\n${report.id},"${report.title}",${report.reportType},${new Date().toISOString()}`;
    });
  }

  async create(orgId: string, data: { title: string; reportType: string }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(reports).values({
        organizationId: orgId,
        title: data.title,
        reportType: data.reportType,
        status: "pending",
      }).returning();

      return {
        id: row.id,
        reportType: row.reportType,
        title: row.title,
        status: row.status,
        generatedAt: row.generatedAt?.toISOString() ?? null,
        createdAt: row.createdAt?.toISOString(),
      };
    });
  }

  async listSchedules(orgId: string) {
    return withTenant(this.db, orgId, async () => {
      const rows = await this.db
        .select()
        .from(scheduledReports)
        .where(eq(scheduledReports.organizationId, orgId))
        .orderBy(desc(scheduledReports.createdAt));
      return rows.map((r) => this.#mapSchedule(r));
    });
  }

  async schedule(orgId: string, creatorId: string, data: {
    reportType: string;
    title: string;
    cronSchedule: string;
    recipients: string[];
    parameters?: Record<string, unknown>;
  }) {
    return withTenant(this.db, orgId, async () => {
      const [row] = await this.db.insert(scheduledReports).values({
        organizationId: orgId,
        creatorId,
        reportType: data.reportType,
        title: data.title,
        cronSchedule: data.cronSchedule,
        recipients: data.recipients,
        parameters: data.parameters ?? {},
        isActive: true,
      }).returning();
      return this.#mapSchedule(row);
    });
  }

  async deleteSchedule(orgId: string, id: string) {
    return withTenant(this.db, orgId, async () => {
      const [deleted] = await this.db
        .delete(scheduledReports)
        .where(and(eq(scheduledReports.id, id), eq(scheduledReports.organizationId, orgId)))
        .returning({ id: scheduledReports.id });
      if (!deleted) throw new NotFoundError("Scheduled report not found");
    });
  }

  #mapSchedule(r: typeof scheduledReports.$inferSelect) {
    return {
      id: r.id,
      reportType: r.reportType,
      title: r.title,
      cronSchedule: r.cronSchedule,
      recipients: (r.recipients as string[]) ?? [],
      parameters: (r.parameters as Record<string, unknown>) ?? {},
      isActive: r.isActive ?? true,
      lastRunAt: r.lastRunAt?.toISOString() ?? null,
      nextRunAt: r.nextRunAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString(),
    };
  }
}
