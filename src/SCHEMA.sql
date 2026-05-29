-- ==============================================================================
-- NEXUS ENTERPRISE SOC - THE ULTIMATE SCHEMA.SQL
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For Geo/Network mapping

-- ==============================================================================
-- 0. GLOBAL ENUMS
-- ==============================================================================
CREATE TYPE severity_level AS ENUM ('critical', 'high', 'medium', 'low', 'info', 'healthy');
CREATE TYPE os_type AS ENUM ('windows', 'linux', 'macos', 'ios', 'android', 'chromeos');
CREATE TYPE cloud_provider AS ENUM ('aws', 'azure', 'gcp', 'oci', 'cloudflare');
CREATE TYPE alert_status AS ENUM ('new', 'triaging', 'escalated', 'suppressed', 'resolved');
CREATE TYPE incident_status AS ENUM ('open', 'investigating', 'contained', 'eradicated', 'recovered', 'closed');
CREATE TYPE network_protocol AS ENUM ('tcp', 'udp', 'icmp', 'http', 'https', 'dns', 'tls', 'ssh');

-- ==============================================================================
-- 1. CORE TENANCY, IDENTITY, & RBAC (Multi-Tenant Architecture)
-- ==============================================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    industry VARCHAR(100),
    data_retention_days INTEGER DEFAULT 90,
    compliance_frameworks JSONB DEFAULT '[]', -- e.g. ["SOC2", "ISO27001", "HIPAA"]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., 'SOC Manager', 'L1 Analyst', 'Threat Hunter'
    permissions JSONB NOT NULL DEFAULT '[]',
    is_system BOOLEAN DEFAULT FALSE
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    mfa_backup_codes JSONB,
    sso_provider VARCHAR(50), -- okta, azure_ad, google
    sso_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    risk_score INTEGER DEFAULT 0, -- Identity risk based on behavior
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE identity_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    anomaly_type VARCHAR(100) NOT NULL, -- e.g., 'impossible_travel', 'mfa_fatigue'
    severity severity_level NOT NULL,
    geo_location_1 JSONB,
    geo_location_2 JSONB,
    time_delta_seconds INTEGER,
    resolved BOOLEAN DEFAULT FALSE,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 2. ASSET & ENDPOINT MANAGEMENT
-- ==============================================================================
CREATE TABLE endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    hostname VARCHAR(255) NOT NULL,
    os os_type NOT NULL,
    os_version VARCHAR(100),
    agent_version VARCHAR(50),
    agent_status VARCHAR(50) DEFAULT 'active', -- active, stale, disconnected
    ip_address VARCHAR(45),
    mac_address VARCHAR(50),
    is_isolated BOOLEAN DEFAULT FALSE,
    isolation_timestamp TIMESTAMP WITH TIME ZONE,
    risk_overall INTEGER DEFAULT 0,
    risk_malware INTEGER DEFAULT 0,
    risk_network INTEGER DEFAULT 0,
    risk_behavior INTEGER DEFAULT 0,
    tags JSONB DEFAULT '[]',
    last_check_in TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Endpoint Granular Telemetry Lookups
CREATE TABLE endpoint_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    process_name VARCHAR(255) NOT NULL,
    process_path TEXT,
    pid INTEGER,
    parent_pid INTEGER,
    command_line TEXT,
    hash_sha256 VARCHAR(64),
    is_signed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE endpoint_network_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    process_id UUID REFERENCES endpoint_processes(id),
    protocol network_protocol,
    local_ip VARCHAR(45),
    local_port INTEGER,
    remote_ip VARCHAR(45),
    remote_port INTEGER,
    bytes_sent BIGINT DEFAULT 0,
    bytes_recv BIGINT DEFAULT 0,
    connection_time TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 3. CLOUD SECURITY POSTURE MANAGEMENT (CSPM)
-- ==============================================================================
CREATE TABLE cloud_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider cloud_provider NOT NULL,
    account_id VARCHAR(255) NOT NULL, -- e.g., AWS Account ID, Azure Subscription
    alias VARCHAR(255),
    sync_status VARCHAR(50) DEFAULT 'healthy',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cloud_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cloud_account_id UUID NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
    asset_type VARCHAR(100) NOT NULL, -- EC2, S3, IAM_Role, Lambda
    asset_name VARCHAR(255) NOT NULL,
    region VARCHAR(50),
    is_publicly_exposed BOOLEAN DEFAULT FALSE,
    configuration JSONB NOT NULL,
    risk_score INTEGER DEFAULT 0,
    discovered_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE cloud_compliance_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cloud_asset_id UUID NOT NULL REFERENCES cloud_assets(id) ON DELETE CASCADE,
    framework VARCHAR(100) NOT NULL, -- e.g., CIS_AWS_v1.4
    control_id VARCHAR(50) NOT NULL, -- e.g., 1.22
    description TEXT,
    severity severity_level NOT NULL,
    passed BOOLEAN DEFAULT FALSE,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. NETWORK & FLOW ANALYTICS
-- ==============================================================================
CREATE TABLE network_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_ip VARCHAR(45) NOT NULL,
    destination_ip VARCHAR(45) NOT NULL,
    source_port INTEGER,
    destination_port INTEGER,
    protocol network_protocol,
    bytes BIGINT DEFAULT 0,
    packets BIGINT DEFAULT 0,
    is_malicious BOOLEAN DEFAULT FALSE,
    geo_country_code VARCHAR(2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dns_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    query_domain VARCHAR(255) NOT NULL,
    query_type VARCHAR(10) NOT NULL, -- A, AAAA, MX, TXT
    response_code VARCHAR(50),
    is_dga BOOLEAN DEFAULT FALSE, -- Domain Generation Algorithm detection
    resolved_ips JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 5. ALERTS & CORRELATION ENGINE
-- ==============================================================================
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query TEXT NOT NULL, -- The SIEM query that triggers the rule
    severity severity_level NOT NULL,
    mitre_techniques JSONB DEFAULT '[]',
    is_enabled BOOLEAN DEFAULT TRUE,
    run_frequency_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    severity severity_level NOT NULL,
    status alert_status DEFAULT 'new',
    ai_priority_score INTEGER DEFAULT 0,
    dedup_count INTEGER DEFAULT 1,
    suppression_reason TEXT,
    raw_trigger_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 6. INCIDENTS & CASES (SOAR / Case Management)
-- ==============================================================================
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    incident_code VARCHAR(50) UNIQUE NOT NULL, -- INC-2026-0001
    title VARCHAR(255) NOT NULL,
    severity severity_level NOT NULL,
    status incident_status DEFAULT 'open',
    lead_investigator_id UUID REFERENCES users(id),
    summary TEXT,
    root_cause_analysis TEXT,
    sla_breach_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incident_alerts (
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    PRIMARY KEY (incident_id, alert_id)
);

CREATE TABLE incident_responders (
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (incident_id, user_id)
);

CREATE TABLE incident_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id),
    evidence_type VARCHAR(50), -- log, pcap, memory_dump, file
    description TEXT,
    s3_uri TEXT,
    hash_sha256 VARCHAR(64),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incident_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    actor_type VARCHAR(50), -- user, system, ai
    actor_name VARCHAR(255),
    action_type VARCHAR(100), -- status_change, evidence_added, containment
    description TEXT NOT NULL
);

-- ==============================================================================
-- 7. KNOWLEDGE BASE & RUNBOOKS (Automation)
-- ==============================================================================
CREATE TABLE runbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_conditions JSONB, -- Array of conditions to auto-start this runbook
    is_automated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE runbook_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    runbook_id UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    action_type VARCHAR(100), -- isolate_host, block_ip, send_email, call_webhook
    action_payload JSONB,
    description TEXT
);

CREATE TABLE incident_runbook_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    runbook_id UUID NOT NULL REFERENCES runbooks(id),
    executed_by UUID REFERENCES users(id), -- Null if system triggered
    status VARCHAR(50) DEFAULT 'running', -- running, success, failed
    log_output TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 8. THREAT INTELLIGENCE & VULNERABILITIES
-- ==============================================================================
CREATE TABLE vulnerabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cve_id VARCHAR(50) UNIQUE NOT NULL,
    cvss_score NUMERIC(3, 1),
    epss_score NUMERIC(5, 4),
    severity severity_level NOT NULL,
    description TEXT,
    patch_available BOOLEAN DEFAULT FALSE,
    exploit_status exploit_status DEFAULT 'none',
    published_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE asset_vulnerabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vulnerability_id UUID NOT NULL REFERENCES vulnerabilities(id),
    asset_id UUID NOT NULL, -- Polymorphic: can be endpoint or cloud_asset
    asset_type VARCHAR(50) NOT NULL, -- 'endpoint' or 'cloud'
    status VARCHAR(50) DEFAULT 'open', -- open, accepted_risk, patched
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE threat_actors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    origin_country VARCHAR(100),
    motivations JSONB DEFAULT '[]',
    description TEXT,
    severity severity_level DEFAULT 'high',
    last_active TIMESTAMP WITH TIME ZONE
);

CREATE TABLE iocs ( -- Indicators of Compromise
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_actor_id UUID REFERENCES threat_actors(id),
    ioc_type VARCHAR(50) NOT NULL, -- ip, domain, file_hash, url
    ioc_value VARCHAR(255) NOT NULL UNIQUE,
    confidence_score INTEGER DEFAULT 100,
    first_seen TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 9. ATTACK GRAPH (Lateral Movement Topologies)
-- ==============================================================================
CREATE TABLE attack_graph_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL, -- user, endpoint, cloud_role, database
    node_name VARCHAR(255) NOT NULL,
    is_compromised BOOLEAN DEFAULT FALSE,
    risk_value INTEGER DEFAULT 0,
    data_payload JSONB -- Extra UI drawing info
);

CREATE TABLE attack_graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES attack_graph_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES attack_graph_nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL, -- 'communicates_with', 'assumes_role', 'executes'
    is_active_attack_path BOOLEAN DEFAULT FALSE,
    mitre_technique VARCHAR(50)
);

-- ==============================================================================
-- 10. COPILOT (AI Workflows) & REPORTING
-- ==============================================================================
CREATE TABLE copilot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workflow_type VARCHAR(100), -- incident_explanation, remediation_plan, query_gen
    context_incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE copilot_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL, -- user, assistant, system
    message_content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id),
    report_type VARCHAR(100) NOT NULL, -- executive_summary, compliance_audit, threat_landscape
    cron_schedule VARCHAR(50) NOT NULL,
    recipients JSONB NOT NULL, -- Array of emails
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 11. PLATFORM HEALTH & AUDIT
-- ==============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL, -- e.g., 'rule_created', 'incident_resolved'
    target_resource VARCHAR(100),
    target_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL, -- crowdstrike, okta, aws
    api_key_encrypted TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'connected', -- connected, degraded, failed
    last_sync_time TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 12. WEBHOOKS & DEVELOPER API
-- ==============================================================================
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    endpoint_url TEXT NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    subscribed_events JSONB NOT NULL, -- ["incident.created", "alert.escalated"]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivery_time_ms INTEGER,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- INDEXES & TRIGGERS
-- ==============================================================================

-- B-Tree Indexes for critical foreign keys and lookups
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_endpoints_org ON endpoints(organization_id);
CREATE INDEX idx_alerts_org ON alerts(organization_id);
CREATE INDEX idx_incidents_org ON incidents(organization_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_cloud_assets_account ON cloud_assets(cloud_account_id);
CREATE INDEX idx_network_flows_ips ON network_flows(source_ip, destination_ip);

-- Time-Series Indexes for high-speed dashboards
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_incidents_opened ON incidents(opened_at DESC);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_network_flows_timestamp ON network_flows(timestamp DESC);
CREATE INDEX idx_identity_anomalies_detected ON identity_anomalies(detected_at DESC);

-- Automated Timestamp Triggers
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_org_update BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_incidents_update BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER trg_alerts_update BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_modified_column();
-- ==============================================================================
-- NEXUS ENTERPRISE SOC — PRODUCTION POSTGRESQL SCHEMA
-- Version: 2.0.0  |  PostgreSQL 16+
-- ==============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- ENUMERATIONS
-- ==============================================================================

CREATE TYPE severity_level AS ENUM (
  'critical', 'high', 'medium', 'low', 'info', 'healthy'
);

CREATE TYPE event_type AS ENUM (
  'failed_login', 'malware_detection', 'suspicious_process', 'dns_anomaly',
  'privilege_escalation', 'suspicious_api', 'iam_change', 'data_exfiltration',
  'brute_force', 'ransomware', 'lateral_movement', 'c2_communication',
  'credential_dump', 'defense_evasion', 'reconnaissance'
);

CREATE TYPE incident_status AS ENUM (
  'open', 'investigating', 'contained', 'eradicated', 'recovered', 'closed'
);

CREATE TYPE alert_status AS ENUM (
  'new', 'triaging', 'acknowledged', 'escalated', 'suppressed', 'resolved'
);

CREATE TYPE endpoint_os AS ENUM (
  'windows', 'linux', 'macos', 'ios', 'android', 'chromeos', 'other'
);

CREATE TYPE endpoint_status AS ENUM (
  'healthy', 'isolated', 'offline', 'compromised', 'remediated', 'decommissioned'
);

CREATE TYPE patch_status AS ENUM (
  'unpatched', 'patch_available', 'patched', 'exception', 'not_applicable'
);

CREATE TYPE exploit_status AS ENUM (
  'none', 'poc', 'active', 'weaponized', 'in_the_wild'
);

CREATE TYPE actor_origin AS ENUM (
  'nation_state', 'criminal', 'hacktivist', 'insider', 'competitor', 'unknown'
);

CREATE TYPE cloud_provider AS ENUM (
  'aws', 'azure', 'gcp', 'oci', 'alibaba', 'cloudflare', 'other'
);

CREATE TYPE network_protocol AS ENUM (
  'tcp', 'udp', 'icmp', 'http', 'https', 'dns', 'tls', 'ssh',
  'ftp', 'smtp', 'smb', 'rdp', 'other'
);

CREATE TYPE ioc_type AS ENUM (
  'ip_address', 'domain', 'url', 'file_hash_md5', 'file_hash_sha1',
  'file_hash_sha256', 'email', 'asn', 'certificate_fingerprint', 'user_agent'
);

CREATE TYPE user_status AS ENUM (
  'active', 'suspended', 'pending_mfa', 'locked', 'deactivated'
);

CREATE TYPE runbook_action_type AS ENUM (
  'isolate_host', 'block_ip', 'disable_user', 'revoke_token',
  'send_notification', 'call_webhook', 'create_ticket', 'run_script',
  'snapshot_host', 'quarantine_file'
);

CREATE TYPE copilot_workflow AS ENUM (
  'incident_explanation', 'remediation_plan', 'anomaly_clustering',
  'threat_prioritization', 'attack_chain_analysis', 'query_generation',
  'investigation_assistant', 'report_generation'
);

CREATE TYPE integration_status AS ENUM (
  'connected', 'degraded', 'failed', 'pending', 'disabled'
);

CREATE TYPE compliance_framework AS ENUM (
  'SOC2', 'ISO27001', 'PCI_DSS', 'HIPAA', 'NIST_CSF',
  'CIS_AWS', 'CIS_AZURE', 'GDPR', 'FedRAMP', 'CMMC'
);

-- ==============================================================================
-- 1. TENANCY & ORGANIZATIONS
-- ==============================================================================

CREATE TABLE organizations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(100) UNIQUE NOT NULL,
  industry              VARCHAR(100),
  logo_url              TEXT,
  primary_contact_email VARCHAR(255),
  max_users             INTEGER DEFAULT 100,
  data_retention_days   INTEGER DEFAULT 90,
  mfa_required          BOOLEAN DEFAULT FALSE,
  sso_enabled           BOOLEAN DEFAULT FALSE,
  sso_provider          VARCHAR(50),
  sso_metadata_url      TEXT,
  settings              JSONB DEFAULT '{}',
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 2. RBAC — ROLES & PERMISSIONS
-- ==============================================================================

CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  permissions     JSONB NOT NULL DEFAULT '[]',
  is_system       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 3. USERS & IDENTITY
-- ==============================================================================

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id             UUID REFERENCES roles(id) ON DELETE SET NULL,
  email               VARCHAR(255) UNIQUE NOT NULL,
  full_name           VARCHAR(255) NOT NULL,
  password_hash       VARCHAR(255),
  avatar_url          TEXT,
  avatar_seed         VARCHAR(255),
  department          VARCHAR(100),
  phone               VARCHAR(30),
  status              user_status DEFAULT 'active',
  mfa_enabled         BOOLEAN DEFAULT FALSE,
  mfa_secret          VARCHAR(255),
  mfa_backup_codes    JSONB,
  mfa_verified_at     TIMESTAMP WITH TIME ZONE,
  sso_provider        VARCHAR(50),
  sso_id              VARCHAR(255),
  workspace_name      VARCHAR(255) DEFAULT 'Default Workspace',
  risk_score          INTEGER DEFAULT 0,
  failed_login_count  INTEGER DEFAULT 0,
  locked_until        TIMESTAMP WITH TIME ZONE,
  last_login_at       TIMESTAMP WITH TIME ZONE,
  last_login_ip       VARCHAR(45),
  last_active_at      TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token   VARCHAR(512) UNIQUE NOT NULL,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  is_revoked      BOOLEAN DEFAULT FALSE,
  expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE identity_anomalies (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anomaly_type        VARCHAR(100) NOT NULL,
  severity            severity_level NOT NULL,
  description         TEXT,
  location_from       JSONB,
  location_to         JSONB,
  speed_km_h          NUMERIC(10, 2),
  time_delta_minutes  INTEGER,
  is_resolved         BOOLEAN DEFAULT FALSE,
  resolved_by         UUID REFERENCES users(id),
  detected_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at         TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 4. API KEYS
-- ==============================================================================

CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  key_hash        VARCHAR(64) UNIQUE NOT NULL,
  key_prefix      VARCHAR(12) NOT NULL,
  scopes          JSONB NOT NULL DEFAULT '[]',
  rate_limit_rpm  INTEGER DEFAULT 1000,
  last_used_at    TIMESTAMP WITH TIME ZONE,
  last_used_ip    VARCHAR(45),
  use_count       BIGINT DEFAULT 0,
  expires_at      TIMESTAMP WITH TIME ZONE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 5. ENDPOINTS & ASSET MANAGEMENT
-- ==============================================================================

CREATE TABLE endpoints (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hostname         VARCHAR(255) NOT NULL,
  display_name     VARCHAR(255),
  os               endpoint_os NOT NULL,
  os_version       VARCHAR(100),
  os_build         VARCHAR(50),
  kernel_version   VARCHAR(100),
  architecture     VARCHAR(20) DEFAULT 'x86_64',
  agent_id         VARCHAR(255) UNIQUE,
  agent_version    VARCHAR(50),
  agent_status     VARCHAR(50) DEFAULT 'active',
  status           endpoint_status DEFAULT 'healthy',
  ip_address       VARCHAR(45),
  external_ip      VARCHAR(45),
  mac_address      VARCHAR(50),
  is_isolated      BOOLEAN DEFAULT FALSE,
  isolated_at      TIMESTAMP WITH TIME ZONE,
  isolated_by      UUID REFERENCES users(id),
  risk_overall     INTEGER DEFAULT 0,
  risk_malware     INTEGER DEFAULT 0,
  risk_network     INTEGER DEFAULT 0,
  risk_credential  INTEGER DEFAULT 0,
  risk_behavior    INTEGER DEFAULT 0,
  session_count    INTEGER DEFAULT 0,
  tags             JSONB DEFAULT '[]',
  labels           JSONB DEFAULT '{}',
  owner_user_id    UUID REFERENCES users(id),
  department       VARCHAR(100),
  location         VARCHAR(255),
  last_check_in    TIMESTAMP WITH TIME ZONE,
  first_seen_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE endpoint_processes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id   UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  process_name  VARCHAR(255) NOT NULL,
  process_path  TEXT,
  pid           INTEGER,
  parent_pid    INTEGER,
  command_line  TEXT,
  username      VARCHAR(255),
  hash_md5      VARCHAR(32),
  hash_sha256   VARCHAR(64),
  is_signed     BOOLEAN,
  signer        VARCHAR(255),
  is_elevated   BOOLEAN DEFAULT FALSE,
  is_malicious  BOOLEAN DEFAULT FALSE,
  started_at    TIMESTAMP WITH TIME ZONE,
  ended_at      TIMESTAMP WITH TIME ZONE
);

CREATE TABLE endpoint_network_connections (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id    UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  process_id     UUID REFERENCES endpoint_processes(id) ON DELETE SET NULL,
  direction      VARCHAR(10),
  protocol       network_protocol,
  local_ip       VARCHAR(45),
  local_port     INTEGER,
  remote_ip      VARCHAR(45),
  remote_port    INTEGER,
  remote_host    VARCHAR(255),
  bytes_sent     BIGINT DEFAULT 0,
  bytes_recv     BIGINT DEFAULT 0,
  packets_sent   BIGINT DEFAULT 0,
  packets_recv   BIGINT DEFAULT 0,
  is_malicious   BOOLEAN DEFAULT FALSE,
  ioc_matched    VARCHAR(255),
  connection_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE endpoint_malware_indicators (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id    UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  indicator_type VARCHAR(50) NOT NULL,
  indicator      TEXT NOT NULL,
  severity       severity_level DEFAULT 'high',
  description    TEXT,
  quarantined    BOOLEAN DEFAULT FALSE,
  detected_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 6. SECURITY EVENTS (SIEM)
-- ==============================================================================

CREATE TABLE security_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  ingested_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  type           event_type NOT NULL,
  severity       severity_level NOT NULL,
  source         VARCHAR(255) NOT NULL,
  source_ip      VARCHAR(45),
  dest_ip        VARCHAR(45),
  source_port    INTEGER,
  dest_port      INTEGER,
  protocol       network_protocol,
  username       VARCHAR(255),
  host           VARCHAR(255),
  endpoint_id    UUID REFERENCES endpoints(id) ON DELETE SET NULL,
  rule_id        VARCHAR(100),
  rule_name      VARCHAR(255),
  message        TEXT NOT NULL,
  country_code   VARCHAR(2),
  asset          VARCHAR(255),
  mitre_tactic   VARCHAR(100),
  mitre_technique VARCHAR(100),
  raw_data       JSONB DEFAULT '{}'
);

-- ==============================================================================
-- 7. ALERT RULES
-- ==============================================================================

CREATE TABLE alert_rules (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by            UUID REFERENCES users(id),
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  query                 TEXT NOT NULL,
  severity              severity_level NOT NULL,
  mitre_tactics         JSONB DEFAULT '[]',
  mitre_techniques      JSONB DEFAULT '[]',
  data_sources          JSONB DEFAULT '[]',
  run_frequency_minutes INTEGER DEFAULT 5,
  lookback_minutes      INTEGER DEFAULT 60,
  threshold_count       INTEGER DEFAULT 1,
  dedup_window_minutes  INTEGER DEFAULT 60,
  suppression_enabled   BOOLEAN DEFAULT FALSE,
  suppression_reason    TEXT,
  is_enabled            BOOLEAN DEFAULT TRUE,
  false_positive_count  INTEGER DEFAULT 0,
  true_positive_count   INTEGER DEFAULT 0,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 8. ALERTS
-- ==============================================================================

CREATE TABLE alerts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id           UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  owner_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  severity          severity_level NOT NULL,
  status            alert_status DEFAULT 'new',
  ai_priority_score INTEGER DEFAULT 0,
  dedup_count       INTEGER DEFAULT 1,
  dedup_key         VARCHAR(255),
  is_escalated      BOOLEAN DEFAULT FALSE,
  is_acknowledged   BOOLEAN DEFAULT FALSE,
  is_suppressed     BOOLEAN DEFAULT FALSE,
  suppression_reason TEXT,
  endpoint_id       UUID REFERENCES endpoints(id) ON DELETE SET NULL,
  source_ip         VARCHAR(45),
  mitre_technique   VARCHAR(100),
  raw_trigger_data  JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 9. INCIDENTS
-- ==============================================================================

CREATE TABLE incidents (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_code         VARCHAR(50) UNIQUE NOT NULL,
  title                 VARCHAR(255) NOT NULL,
  description           TEXT,
  severity              severity_level NOT NULL,
  status                incident_status DEFAULT 'open',
  lead_investigator_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  category              VARCHAR(100),
  affected_assets_count INTEGER DEFAULT 0,
  affected_users_count  INTEGER DEFAULT 0,
  summary               TEXT,
  root_cause_analysis   TEXT,
  remediation_steps     TEXT,
  postmortem_url        TEXT,
  sla_hours             INTEGER DEFAULT 24,
  sla_breach_at         TIMESTAMP WITH TIME ZONE,
  sla_breached          BOOLEAN DEFAULT FALSE,
  escalated             BOOLEAN DEFAULT FALSE,
  escalated_at          TIMESTAMP WITH TIME ZONE,
  opened_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  contained_at          TIMESTAMP WITH TIME ZONE,
  resolved_at           TIMESTAMP WITH TIME ZONE,
  closed_at             TIMESTAMP WITH TIME ZONE
);

CREATE TABLE incident_mitre_techniques (
  incident_id    UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  mitre_id       VARCHAR(20) NOT NULL,
  mitre_name     VARCHAR(255),
  mitre_tactic   VARCHAR(100),
  PRIMARY KEY (incident_id, mitre_id)
);

CREATE TABLE incident_alerts (
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  alert_id    UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  linked_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  linked_by   UUID REFERENCES users(id),
  PRIMARY KEY (incident_id, alert_id)
);

CREATE TABLE incident_responders (
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(100) DEFAULT 'responder',
  joined_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (incident_id, user_id)
);

CREATE TABLE incident_timeline (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  timestamp    TIMESTAMP WITH TIME ZONE NOT NULL,
  actor_type   VARCHAR(20) DEFAULT 'user',
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name   VARCHAR(255),
  action_type  VARCHAR(100) NOT NULL,
  description  TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}'
);

CREATE TABLE incident_comments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id          UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  content              TEXT NOT NULL,
  is_system_generated  BOOLEAN DEFAULT FALSE,
  parent_comment_id    UUID REFERENCES incident_comments(id),
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incident_evidence (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  added_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  type         VARCHAR(50) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  file_name    VARCHAR(255),
  file_size_bytes BIGINT,
  mime_type    VARCHAR(100),
  storage_uri  TEXT,
  hash_sha256  VARCHAR(64),
  is_sensitive BOOLEAN DEFAULT FALSE,
  added_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incident_recommendations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  order_index  INTEGER DEFAULT 0
);

-- ==============================================================================
-- 10. CASES (Long-term Investigations)
-- ==============================================================================

CREATE TABLE cases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_number     VARCHAR(50) UNIQUE NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(50) DEFAULT 'open',
  priority        severity_level DEFAULT 'medium',
  owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  tags            JSONB DEFAULT '[]',
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  closed_at       TIMESTAMP WITH TIME ZONE
);

CREATE TABLE case_incidents (
  case_id     UUID REFERENCES cases(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  linked_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (case_id, incident_id)
);

CREATE TABLE investigation_notebooks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES cases(id) ON DELETE SET NULL,
  incident_id     UUID REFERENCES incidents(id) ON DELETE SET NULL,
  author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  content         TEXT,
  is_published    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 11. VULNERABILITIES & CVE TRACKING
-- ==============================================================================

CREATE TABLE vulnerabilities (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cve_id           VARCHAR(50) UNIQUE NOT NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  cvss_score       NUMERIC(3, 1),
  cvss_vector      VARCHAR(100),
  epss_score       NUMERIC(5, 4),
  epss_percentile  NUMERIC(5, 4),
  severity         severity_level NOT NULL,
  patch_status     patch_status DEFAULT 'unpatched',
  exploit_status   exploit_status DEFAULT 'none',
  affected_packages JSONB DEFAULT '[]',
  references       JSONB DEFAULT '[]',
  cwe_ids          JSONB DEFAULT '[]',
  published_at     TIMESTAMP WITH TIME ZONE,
  last_modified_at TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE asset_vulnerabilities (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vulnerability_id  UUID NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  asset_id          UUID NOT NULL,
  asset_type        VARCHAR(20) NOT NULL,
  status            VARCHAR(50) DEFAULT 'open',
  risk_accepted     BOOLEAN DEFAULT FALSE,
  risk_accepted_by  UUID REFERENCES users(id),
  risk_accepted_at  TIMESTAMP WITH TIME ZONE,
  patched_at        TIMESTAMP WITH TIME ZONE,
  discovered_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 12. THREAT INTELLIGENCE
-- ==============================================================================

CREATE TABLE threat_actors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) UNIQUE NOT NULL,
  aliases         JSONB DEFAULT '[]',
  origin_country  VARCHAR(100),
  origin_type     actor_origin DEFAULT 'unknown',
  description     TEXT,
  motivation      JSONB DEFAULT '[]',
  ttps            JSONB DEFAULT '[]',
  linked_campaigns JSONB DEFAULT '[]',
  severity        severity_level DEFAULT 'high',
  is_active       BOOLEAN DEFAULT TRUE,
  first_seen      TIMESTAMP WITH TIME ZONE,
  last_seen       TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE threat_actor_timeline (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID NOT NULL REFERENCES threat_actors(id) ON DELETE CASCADE,
  event_date  TIMESTAMP WITH TIME ZONE NOT NULL,
  event_title VARCHAR(255) NOT NULL,
  event_desc  TEXT
);

CREATE TABLE iocs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  threat_actor_id   UUID REFERENCES threat_actors(id) ON DELETE SET NULL,
  ioc_type          ioc_type NOT NULL,
  value             TEXT NOT NULL,
  context           TEXT,
  confidence_score  INTEGER DEFAULT 80,
  severity          severity_level DEFAULT 'high',
  is_active         BOOLEAN DEFAULT TRUE,
  first_seen        TIMESTAMP WITH TIME ZONE,
  last_seen         TIMESTAMP WITH TIME ZONE,
  expires_at        TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ioc_type, value)
);

-- ==============================================================================
-- 13. CLOUD SECURITY POSTURE MANAGEMENT (CSPM)
-- ==============================================================================

CREATE TABLE cloud_accounts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider          cloud_provider NOT NULL,
  account_id        VARCHAR(255) NOT NULL,
  account_alias     VARCHAR(255),
  regions           JSONB DEFAULT '[]',
  sync_status       VARCHAR(50) DEFAULT 'healthy',
  last_sync_at      TIMESTAMP WITH TIME ZONE,
  error_message     TEXT,
  total_assets      INTEGER DEFAULT 0,
  risk_score        INTEGER DEFAULT 0,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cloud_assets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cloud_account_id  UUID NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
  asset_type        VARCHAR(100) NOT NULL,
  asset_id          VARCHAR(255) NOT NULL,
  asset_name        VARCHAR(255),
  region            VARCHAR(50),
  availability_zone VARCHAR(50),
  vpc_id            VARCHAR(100),
  tags              JSONB DEFAULT '{}',
  configuration     JSONB NOT NULL DEFAULT '{}',
  is_public         BOOLEAN DEFAULT FALSE,
  risk_score        INTEGER DEFAULT 0,
  discovered_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at      TIMESTAMP WITH TIME ZONE,
  UNIQUE(cloud_account_id, asset_id)
);

CREATE TABLE cloud_compliance_checks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cloud_asset_id   UUID NOT NULL REFERENCES cloud_assets(id) ON DELETE CASCADE,
  framework        compliance_framework NOT NULL,
  control_id       VARCHAR(50) NOT NULL,
  control_title    VARCHAR(255) NOT NULL,
  description      TEXT,
  severity         severity_level NOT NULL,
  status           VARCHAR(20) DEFAULT 'failed',
  remediation      TEXT,
  scanned_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cloud_iam_findings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cloud_account_id UUID NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
  principal_type   VARCHAR(50),
  principal_id     VARCHAR(255),
  principal_name   VARCHAR(255),
  finding_type     VARCHAR(100) NOT NULL,
  risk_level       severity_level NOT NULL,
  affected_resource TEXT,
  policy_name      VARCHAR(255),
  description      TEXT,
  is_resolved      BOOLEAN DEFAULT FALSE,
  detected_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 14. NETWORK ANALYTICS
-- ==============================================================================

CREATE TABLE network_flows (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_ip        VARCHAR(45) NOT NULL,
  destination_ip   VARCHAR(45) NOT NULL,
  source_port      INTEGER,
  destination_port INTEGER,
  protocol         network_protocol,
  bytes_total      BIGINT DEFAULT 0,
  packets_total    BIGINT DEFAULT 0,
  duration_ms      INTEGER,
  is_malicious     BOOLEAN DEFAULT FALSE,
  threat_category  VARCHAR(100),
  geo_country_src  VARCHAR(2),
  geo_country_dst  VARCHAR(2),
  geo_lat_src      NUMERIC(9, 6),
  geo_lng_src      NUMERIC(9, 6),
  geo_lat_dst      NUMERIC(9, 6),
  geo_lng_dst      NUMERIC(9, 6),
  asn_src          VARCHAR(50),
  asn_dst          VARCHAR(50),
  endpoint_id      UUID REFERENCES endpoints(id) ON DELETE SET NULL,
  flow_start       TIMESTAMP WITH TIME ZONE NOT NULL,
  flow_end         TIMESTAMP WITH TIME ZONE
);

CREATE TABLE dns_queries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_id     UUID REFERENCES endpoints(id) ON DELETE SET NULL,
  source_ip       VARCHAR(45),
  query_domain    VARCHAR(512) NOT NULL,
  query_type      VARCHAR(10) NOT NULL,
  response_code   VARCHAR(20),
  response_ips    JSONB,
  entropy_score   NUMERIC(5, 3),
  is_dga          BOOLEAN DEFAULT FALSE,
  is_blocklisted  BOOLEAN DEFAULT FALSE,
  threat_category VARCHAR(100),
  queried_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 15. ATTACK GRAPH
-- ==============================================================================

CREATE TABLE attack_graphs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id     UUID REFERENCES incidents(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  generated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attack_graph_nodes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  graph_id        UUID NOT NULL REFERENCES attack_graphs(id) ON DELETE CASCADE,
  node_type       VARCHAR(50) NOT NULL,
  label           VARCHAR(255) NOT NULL,
  asset_id        UUID,
  asset_type      VARCHAR(50),
  is_compromised  BOOLEAN DEFAULT FALSE,
  is_entry_point  BOOLEAN DEFAULT FALSE,
  is_target       BOOLEAN DEFAULT FALSE,
  risk_score      INTEGER DEFAULT 0,
  x_pos           NUMERIC(10, 2),
  y_pos           NUMERIC(10, 2),
  metadata        JSONB DEFAULT '{}'
);

CREATE TABLE attack_graph_edges (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  graph_id            UUID NOT NULL REFERENCES attack_graphs(id) ON DELETE CASCADE,
  source_node_id      UUID NOT NULL REFERENCES attack_graph_nodes(id) ON DELETE CASCADE,
  target_node_id      UUID NOT NULL REFERENCES attack_graph_nodes(id) ON DELETE CASCADE,
  relationship_type   VARCHAR(100) NOT NULL,
  mitre_technique     VARCHAR(50),
  is_active_path      BOOLEAN DEFAULT FALSE,
  confidence_score    INTEGER DEFAULT 80,
  metadata            JSONB DEFAULT '{}'
);

-- ==============================================================================
-- 16. RUNBOOKS & AUTOMATION
-- ==============================================================================

CREATE TABLE runbooks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by          UUID REFERENCES users(id),
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  category            VARCHAR(100),
  trigger_severity    severity_level,
  trigger_event_types JSONB DEFAULT '[]',
  is_automated        BOOLEAN DEFAULT FALSE,
  is_enabled          BOOLEAN DEFAULT TRUE,
  execution_count     INTEGER DEFAULT 0,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE runbook_steps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  runbook_id      UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  action_type     runbook_action_type NOT NULL,
  action_payload  JSONB NOT NULL DEFAULT '{}',
  timeout_seconds INTEGER DEFAULT 60,
  on_failure      VARCHAR(20) DEFAULT 'stop',
  is_manual       BOOLEAN DEFAULT FALSE
);

CREATE TABLE runbook_executions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  runbook_id     UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  incident_id    UUID REFERENCES incidents(id) ON DELETE SET NULL,
  triggered_by   UUID REFERENCES users(id),
  status         VARCHAR(20) DEFAULT 'running',
  log_output     TEXT,
  step_results   JSONB DEFAULT '[]',
  started_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at   TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 17. KNOWLEDGE BASE
-- ==============================================================================

CREATE TABLE knowledge_articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  title           VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL,
  content         TEXT NOT NULL,
  category        VARCHAR(100),
  tags            JSONB DEFAULT '[]',
  is_published    BOOLEAN DEFAULT FALSE,
  view_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, slug)
);

-- ==============================================================================
-- 18. COMPLIANCE
-- ==============================================================================

CREATE TABLE compliance_assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework       compliance_framework NOT NULL,
  name            VARCHAR(255) NOT NULL,
  total_controls  INTEGER DEFAULT 0,
  passed_controls INTEGER DEFAULT 0,
  score_percent   NUMERIC(5, 2),
  status          VARCHAR(50) DEFAULT 'in_progress',
  assessed_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  next_due_at     TIMESTAMP WITH TIME ZONE
);

CREATE TABLE compliance_controls (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id    UUID NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  control_id       VARCHAR(50) NOT NULL,
  control_title    VARCHAR(255) NOT NULL,
  description      TEXT,
  status           VARCHAR(20) DEFAULT 'not_started',
  evidence_notes   TEXT,
  assignee_id      UUID REFERENCES users(id),
  due_date         TIMESTAMP WITH TIME ZONE,
  completed_at     TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 19. COPILOT (AI)
-- ==============================================================================

CREATE TABLE copilot_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255),
  workflow_type   copilot_workflow,
  incident_id     UUID REFERENCES incidents(id) ON DELETE SET NULL,
  alert_id        UUID REFERENCES alerts(id) ON DELETE SET NULL,
  context         JSONB DEFAULT '{}',
  message_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE copilot_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
  sender_role   VARCHAR(20) NOT NULL,
  content       TEXT NOT NULL,
  model_used    VARCHAR(100),
  prompt_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  latency_ms    INTEGER,
  suggestions   JSONB DEFAULT '[]',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 20. REPORTS
-- ==============================================================================

CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),
  report_type     VARCHAR(100) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  parameters      JSONB DEFAULT '{}',
  status          VARCHAR(20) DEFAULT 'pending',
  storage_uri     TEXT,
  generated_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheduled_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  creator_id      UUID REFERENCES users(id),
  report_type     VARCHAR(100) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  cron_schedule   VARCHAR(50) NOT NULL,
  recipients      JSONB NOT NULL DEFAULT '[]',
  parameters      JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  last_run_at     TIMESTAMP WITH TIME ZONE,
  next_run_at     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 21. NOTIFICATIONS
-- ==============================================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(100) NOT NULL,
  severity        severity_level DEFAULT 'info',
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  action_url      TEXT,
  resource_type   VARCHAR(50),
  resource_id     UUID,
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 22. WEBHOOKS & DEVELOPER
-- ==============================================================================

CREATE TABLE webhooks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES users(id),
  name              VARCHAR(255) NOT NULL,
  endpoint_url      TEXT NOT NULL,
  secret_key        VARCHAR(255) NOT NULL,
  subscribed_events JSONB NOT NULL DEFAULT '[]',
  headers           JSONB DEFAULT '{}',
  is_active         BOOLEAN DEFAULT TRUE,
  failure_count     INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_deliveries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id       UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type       VARCHAR(100) NOT NULL,
  payload          JSONB NOT NULL,
  response_status  INTEGER,
  response_body    TEXT,
  delivery_time_ms INTEGER,
  retry_count      INTEGER DEFAULT 0,
  success          BOOLEAN DEFAULT FALSE,
  delivered_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 23. PLATFORM INTEGRATIONS
-- ==============================================================================

CREATE TABLE platform_integrations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  configured_by     UUID REFERENCES users(id),
  provider          VARCHAR(100) NOT NULL,
  display_name      VARCHAR(255),
  credentials       JSONB NOT NULL DEFAULT '{}',
  config            JSONB DEFAULT '{}',
  status            integration_status DEFAULT 'pending',
  sync_enabled      BOOLEAN DEFAULT TRUE,
  last_sync_at      TIMESTAMP WITH TIME ZONE,
  last_error        TEXT,
  events_ingested   BIGINT DEFAULT 0,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 24. AUDIT LOG
-- ==============================================================================

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email      VARCHAR(255),
  action          VARCHAR(255) NOT NULL,
  resource_type   VARCHAR(100),
  resource_id     UUID,
  resource_label  VARCHAR(255),
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  old_values      JSONB,
  new_values      JSONB,
  metadata        JSONB DEFAULT '{}',
  timestamp       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 25. PLATFORM HEALTH
-- ==============================================================================

CREATE TABLE platform_health_checks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name VARCHAR(100) NOT NULL,
  status       VARCHAR(20) DEFAULT 'healthy',
  latency_ms   INTEGER,
  error_msg    TEXT,
  metadata     JSONB DEFAULT '{}',
  checked_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- INDEXES — Performance Optimization
-- ==============================================================================

-- Core FK lookups
CREATE INDEX idx_users_org           ON users(organization_id);
CREATE INDEX idx_users_email         ON users(email);
CREATE INDEX idx_endpoints_org       ON endpoints(organization_id);
CREATE INDEX idx_alerts_org          ON alerts(organization_id);
CREATE INDEX idx_incidents_org       ON incidents(organization_id);
CREATE INDEX idx_audit_logs_org      ON audit_logs(organization_id);
CREATE INDEX idx_notifications_user  ON notifications(user_id, is_read);
CREATE INDEX idx_cloud_assets_acct   ON cloud_assets(cloud_account_id);
CREATE INDEX idx_iocs_type_val       ON iocs(ioc_type, value);

-- Time-series dashboard queries
CREATE INDEX idx_events_timestamp    ON security_events(event_timestamp DESC);
CREATE INDEX idx_alerts_created      ON alerts(created_at DESC);
CREATE INDEX idx_incidents_opened    ON incidents(opened_at DESC);
CREATE INDEX idx_flows_start         ON network_flows(flow_start DESC);
CREATE INDEX idx_dns_queried         ON dns_queries(queried_at DESC);
CREATE INDEX idx_audit_timestamp     ON audit_logs(timestamp DESC);

-- Severity/Status filter indexes (SOC dashboard filters)
CREATE INDEX idx_alerts_status_sev   ON alerts(organization_id, status, severity);
CREATE INDEX idx_incidents_status    ON incidents(organization_id, status, severity);
CREATE INDEX idx_vuln_cvss           ON vulnerabilities(cvss_score DESC);
CREATE INDEX idx_endpoints_risk      ON endpoints(organization_id, risk_overall DESC);

-- Unique hash searches
CREATE INDEX idx_api_keys_hash       ON api_keys(key_hash);
CREATE INDEX idx_sessions_token      ON user_sessions(refresh_token);

-- ==============================================================================
-- TRIGGERS — Auto-update 'updated_at'
-- ==============================================================================

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orgs_upd          BEFORE UPDATE ON organizations          FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_users_upd         BEFORE UPDATE ON users                  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_endpoints_upd     BEFORE UPDATE ON endpoints              FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_alerts_upd        BEFORE UPDATE ON alerts                 FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_alert_rules_upd   BEFORE UPDATE ON alert_rules            FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_incidents_upd     BEFORE UPDATE ON incidents              FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_cases_upd         BEFORE UPDATE ON cases                  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_copilot_upd       BEFORE UPDATE ON copilot_sessions       FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_webhooks_upd      BEFORE UPDATE ON webhooks               FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_runbooks_upd      BEFORE UPDATE ON runbooks               FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_integrations_upd  BEFORE UPDATE ON platform_integrations  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_knowledge_upd     BEFORE UPDATE ON knowledge_articles     FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ==============================================================================
-- SEED — Default System Roles
-- ==============================================================================

INSERT INTO organizations (id, name, slug, industry)
VALUES ('00000000-0000-0000-0000-000000000001', 'Nexus Platform', 'nexus-platform', 'Technology');

INSERT INTO roles (organization_id, name, description, permissions, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'super_admin',        'Full platform & org control',                '["*"]',                                                    TRUE),
  ('00000000-0000-0000-0000-000000000001', 'security_admin',     'Operational + integrations + settings',      '["view:*","act:incidents","manage:integrations"]',         TRUE),
  ('00000000-0000-0000-0000-000000000001', 'soc_analyst',        'Triage events, act on incidents',            '["view:dashboard","view:events","view:incidents","act:incidents","view:alerts"]', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'threat_hunter',      'Read-only investigation & hunting',          '["view:dashboard","view:events","view:threat-intel","view:endpoints"]', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'incident_responder', 'Take action on active incidents',            '["view:incidents","act:incidents","view:endpoints"]',       TRUE),
  ('00000000-0000-0000-0000-000000000001', 'compliance_officer', 'Compliance, audit, governance',              '["view:compliance","view:audit","view:reports"]',           TRUE),
  ('00000000-0000-0000-0000-000000000001', 'viewer',             'Read-only across operational views',         '["view:dashboard","view:events","view:incidents"]',         TRUE);
