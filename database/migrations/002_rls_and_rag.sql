-- Row-Level Security policies for multi-tenant isolation
-- Run after 001_schema.sql

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE runbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_anomalies ENABLE ROW LEVEL SECURITY;

-- Tenant isolation via session variable app.current_org
CREATE POLICY tenant_isolation_users ON users
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_endpoints ON endpoints
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_events ON security_events
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_alerts ON alerts
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_alert_rules ON alert_rules
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_incidents ON incidents
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_cases ON cases
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_notifications ON notifications
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_audit ON audit_logs
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_copilot ON copilot_sessions
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_knowledge ON knowledge_articles
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_api_keys ON api_keys
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_webhooks ON webhooks
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_integrations ON platform_integrations
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_cloud ON cloud_accounts
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_flows ON network_flows
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_dns ON dns_queries
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_notebooks ON investigation_notebooks
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_runbooks ON runbooks
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_compliance ON compliance_assessments
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_reports ON reports
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_asset_vuln ON asset_vulnerabilities
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_attack_graphs ON attack_graphs
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_identity ON identity_anomalies
  USING (organization_id = current_setting('app.current_org', true)::uuid);

-- Composite indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_events_org_ts ON security_events(organization_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_open ON alerts(organization_id, created_at DESC) WHERE status NOT IN ('resolved', 'suppressed');
CREATE INDEX IF NOT EXISTS idx_incidents_open ON incidents(organization_id, opened_at DESC) WHERE status NOT IN ('closed', 'recovered');

-- pgvector for RAG (optional — requires pgvector extension)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_embeddings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type     VARCHAR(50) NOT NULL,
  source_id       UUID NOT NULL,
  chunk_index     INTEGER DEFAULT 0,
  chunk_text      TEXT NOT NULL,
  embedding       vector(1536),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_embeddings_org ON document_embeddings(organization_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON document_embeddings(source_type, source_id);

ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_embeddings ON document_embeddings
  USING (organization_id = current_setting('app.current_org', true)::uuid);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_incidents_fts ON incidents USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'')));
CREATE INDEX IF NOT EXISTS idx_alerts_fts ON alerts USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
CREATE INDEX IF NOT EXISTS idx_events_fts ON security_events USING gin(to_tsvector('english', coalesce(message,'')));
