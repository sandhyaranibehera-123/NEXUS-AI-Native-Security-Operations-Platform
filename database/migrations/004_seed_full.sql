-- Extended seed data for all SOC modules (Acme Federal org)

-- Endpoints
INSERT INTO endpoints (organization_id, hostname, os, os_version, ip_address, agent_version, status, risk_overall, risk_malware, risk_network, risk_credential, risk_behavior, session_count, last_check_in, is_isolated)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'web-prod-12.nyc', 'linux', 'Ubuntu 22.04', '10.0.1.12', '14.2.1', 'healthy', 94, 90, 70, 40, 50, 3, NOW() - INTERVAL '2 minutes', false),
  ('00000000-0000-0000-0000-000000000002', 'finance-laptop-08', 'windows', 'Windows 11', '10.0.2.88', '14.1.3', 'healthy', 87, 60, 50, 80, 45, 1, NOW() - INTERVAL '4 minutes', false),
  ('00000000-0000-0000-0000-000000000002', 'build-runner-44', 'linux', 'Debian 12', '10.0.3.44', '14.2.0', 'healthy', 78, 40, 85, 30, 55, 2, NOW() - INTERVAL '11 minutes', false),
  ('00000000-0000-0000-0000-000000000002', 'win-hr-laptop-03', 'windows', 'Windows 11', '10.0.4.33', '14.1.3', 'isolated', 92, 95, 60, 70, 80, 1, NOW() - INTERVAL '15 minutes', true)
ON CONFLICT DO NOTHING;

-- Vulnerabilities (global CVE catalog)
INSERT INTO vulnerabilities (cve_id, title, description, cvss_score, epss_score, severity, patch_status, exploit_status, affected_packages, published_at)
VALUES
  ('CVE-2024-3094', 'xz-utils backdoor (liblzma)', 'Supply chain backdoor in xz-utils', 10.0, 0.95, 'critical', 'unpatched', 'in_the_wild', '["xz-utils"]', NOW() - INTERVAL '30 days'),
  ('CVE-2024-21413', 'Microsoft Outlook RCE', 'Critical RCE via crafted email', 9.8, 0.88, 'critical', 'patch_available', 'active', '["outlook"]', NOW() - INTERVAL '60 days'),
  ('CVE-2023-4966', 'Citrix Bleed', 'Sensitive information disclosure', 9.4, 0.92, 'critical', 'patched', 'weaponized', '["citrix-netscaler"]', NOW() - INTERVAL '120 days')
ON CONFLICT (cve_id) DO NOTHING;

INSERT INTO asset_vulnerabilities (organization_id, vulnerability_id, asset_id, asset_type, status)
SELECT '00000000-0000-0000-0000-000000000002', v.id, e.id, 'endpoint', 'open'
FROM vulnerabilities v, endpoints e
WHERE v.cve_id IN ('CVE-2024-3094', 'CVE-2024-21413') AND e.organization_id = '00000000-0000-0000-0000-000000000002'
LIMIT 6;

-- Threat actors
INSERT INTO threat_actors (name, aliases, origin_type, motivation, ttps, severity, is_active, last_seen)
VALUES
  ('APT29', '["Cozy Bear","The Dukes"]', 'nation_state', '["espionage"]', '["T1078","T1566","T1059"]', 'critical', true, NOW() - INTERVAL '2 days'),
  ('APT41', '["Double Dragon"]', 'nation_state', '["espionage","financial"]', '["T1190","T1055"]', 'critical', true, NOW() - INTERVAL '5 days'),
  ('FIN7', '["Carbanak"]', 'criminal', '["financial"]', '["T1566","T1055"]', 'high', true, NOW() - INTERVAL '7 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO threat_actor_timeline (actor_id, event_date, event_title, event_desc)
SELECT id, NOW() - INTERVAL '30 days', 'Campaign observed targeting financial sector', 'Spear-phishing with macro-enabled documents'
FROM threat_actors WHERE name = 'APT29';

INSERT INTO iocs (organization_id, ioc_type, value, context, confidence_score, severity, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'ip_address', '185.220.101.42', 'BulletProof hosting ASN', 90, 'high', true),
  ('00000000-0000-0000-0000-000000000002', 'domain', 'update-cdn-secure.net', 'C2 domain <72h old', 85, 'critical', true),
  ('00000000-0000-0000-0000-000000000002', 'file_hash_sha256', 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456', 'Ransomware loader', 95, 'critical', true);

-- Cloud
INSERT INTO cloud_accounts (organization_id, provider, account_id, account_alias, regions, sync_status, total_assets, risk_score, last_sync_at)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'aws', '123456789012', 'aws-prod', '["us-east-1","eu-west-1"]', 'healthy', 1240, 64, NOW()),
  ('00000000-0000-0000-0000-000000000002', 'azure', 'sub-prod-001', 'azure-prod', '["eastus"]', 'healthy', 890, 58, NOW())
ON CONFLICT DO NOTHING;

INSERT INTO cloud_iam_findings (cloud_account_id, principal_name, finding_type, risk_level, description)
SELECT ca.id, 'build-runner-44', 'wildcard_policy', 'high', 'AdministratorAccess attached outside change window'
FROM cloud_accounts ca WHERE ca.account_alias = 'aws-prod' LIMIT 1;

-- Network
INSERT INTO network_flows (organization_id, source_ip, destination_ip, source_port, destination_port, protocol, bytes_total, is_malicious, threat_category, geo_country_src, geo_country_dst, flow_start)
VALUES
  ('00000000-0000-0000-0000-000000000002', '10.0.1.12', '185.220.101.42', 52431, 443, 'tcp', 45000, true, 'C2', 'US', 'NL', NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0000-000000000002', '10.0.2.88', '10.0.1.5', 445, 445, 'tcp', 1200000, false, NULL, 'US', 'US', NOW() - INTERVAL '30 minutes');

INSERT INTO dns_queries (organization_id, query_domain, query_type, entropy_score, is_dga, is_blocklisted, threat_category, queried_at)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'update-cdn-secure.net', 'A', 4.2, true, true, 'C2', NOW() - INTERVAL '45 minutes'),
  ('00000000-0000-0000-0000-000000000002', 'login.microsoftonline.com', 'A', 2.1, false, false, NULL, NOW() - INTERVAL '10 minutes');

-- Cases
INSERT INTO cases (organization_id, case_number, title, description, status, priority, owner_id)
SELECT '00000000-0000-0000-0000-000000000002', 'CASE-2024-089', 'APT29 financial sector campaign', 'Long-term investigation into nation-state activity', 'open', 'high', '00000000-0000-0000-0000-000000000010'
ON CONFLICT (case_number) DO NOTHING;

INSERT INTO investigation_notebooks (organization_id, author_id, title, content, is_published)
VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'INC-1042 IAM escalation analysis', '## Findings\nOIDC trust policy misconfiguration on build-runner.', true);

-- Compliance
INSERT INTO compliance_assessments (organization_id, framework, name, total_controls, passed_controls, score_percent, status)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'SOC2', 'SOC 2 Type II Q1 2024', 120, 105, 87.50, 'in_progress'),
  ('00000000-0000-0000-0000-000000000002', 'ISO27001', 'ISO 27001 Annual', 93, 81, 87.10, 'in_progress');

INSERT INTO compliance_controls (assessment_id, control_id, control_title, status)
SELECT a.id, 'CC6.1', 'Logical access controls', 'passed'
FROM compliance_assessments a WHERE a.name LIKE 'SOC 2%' LIMIT 1;

-- Runbooks
INSERT INTO runbooks (organization_id, name, description, category, is_automated, is_enabled)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'Ransomware containment', 'Isolate and contain ransomware incidents', 'Malware', true, true),
  ('00000000-0000-0000-0000-000000000002', 'IAM privilege revocation', 'Revoke unauthorized IAM bindings', 'Identity', true, true);

INSERT INTO runbook_steps (runbook_id, step_order, name, action_type, is_manual)
SELECT r.id, 1, 'Isolate affected endpoints', 'isolate_host', false
FROM runbooks r WHERE r.name = 'Ransomware containment' LIMIT 1;

-- Reports
INSERT INTO reports (organization_id, report_type, title, status, generated_at)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'executive', 'Weekly Executive Summary', 'completed', NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000002', 'soc', 'SOC Metrics Dashboard', 'pending', NULL);

-- Integrations
INSERT INTO platform_integrations (organization_id, provider, display_name, status, events_ingested, last_sync_at)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'splunk', 'Splunk Enterprise', 'connected', 2400000, NOW()),
  ('00000000-0000-0000-0000-000000000002', 'okta', 'Okta Identity', 'connected', 890000, NOW()),
  ('00000000-0000-0000-0000-000000000002', 'crowdstrike', 'CrowdStrike Falcon', 'connected', 1200000, NOW());

-- Webhooks (secret is placeholder hash in prod use encrypted)
INSERT INTO webhooks (organization_id, name, endpoint_url, secret_key, subscribed_events, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'SOC Slack', 'https://hooks.slack.com/services/xxx', 'whsec_placeholder', '["incident.created","alert.critical"]', true);

-- API keys (hash only — prefix nx_demo_key_)
INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, scopes, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'CI Pipeline', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'nx_demo_key_', '["read:events","ingest:events"]', true);

-- Attack graph
INSERT INTO attack_graphs (organization_id, incident_id, name, description)
SELECT '00000000-0000-0000-0000-000000000002', i.id, 'INC-1042 Attack Chain', 'IAM escalation to secrets vault'
FROM incidents i WHERE i.incident_code = 'INC-1042' LIMIT 1;

-- Audit logs
INSERT INTO audit_logs (organization_id, user_id, user_email, action, resource_type)
VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'amelia.lee@acme.federal', 'incident.status_changed', 'incident'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'amelia.lee@acme.federal', 'detection.rule.updated', 'alert_rule'),
  ('00000000-0000-0000-0000-000000000002', NULL, 'api-token:ci-bot', 'search.export', 'events');

-- Platform health
INSERT INTO platform_health_checks (service_name, status, latency_ms)
VALUES
  ('api-gateway', 'healthy', 12),
  ('postgres-primary', 'healthy', 3),
  ('redis-cache', 'healthy', 1),
  ('event-ingest', 'healthy', 45),
  ('copilot-llm', 'healthy', 1800),
  ('websocket-hub', 'healthy', 8);

-- Identity anomalies
INSERT INTO identity_anomalies (organization_id, user_id, anomaly_type, severity, description, is_resolved)
SELECT '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'impossible_travel', 'high', 'Login from US then NL within 20 minutes', false;
