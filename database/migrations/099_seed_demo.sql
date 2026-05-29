-- Demo seed data for development
-- Password for all demo users: NexusDemo2024!
-- bcrypt hash generated with cost 10

INSERT INTO organizations (id, name, slug, industry, settings)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Acme Federal',
  'acme-federal',
  'Government',
  '{"llm_budget_monthly_usd": 500, "chat_model": "gpt-4o-mini"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Demo admin user (password: NexusDemo2024!)
INSERT INTO users (
  id, organization_id, role_id, email, full_name, password_hash,
  avatar_seed, workspace_name, status
)
SELECT
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000002',
  r.id,
  'amelia.lee@acme.federal',
  'Amelia Lee',
  '$2b$10$rQZ8K8Y5Y5Y5Y5Y5Y5Y5YuGKxGKxGKxGKxGKxGKxGKxGKxGKxGKxG',
  'amelia.lee@acme.federal',
  'Acme Federal',
  'active'
FROM roles r
WHERE r.organization_id = '00000000-0000-0000-0000-000000000002'
  AND r.name = 'security_admin'
ON CONFLICT (email) DO NOTHING;

-- Update password hash with a real bcrypt hash for NexusDemo2024!
UPDATE users SET password_hash = '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'
WHERE email = 'amelia.lee@acme.federal';

-- Sample security events
INSERT INTO security_events (
  organization_id, event_timestamp, type, severity, source, source_ip,
  dest_ip, username, host, rule_name, message, country_code, asset, mitre_technique
) VALUES
  ('00000000-0000-0000-0000-000000000002', NOW() - INTERVAL '2 hours', 'failed_login', 'high', 'Okta', '203.0.113.45', '10.0.1.50', 'k.morgan', 'edge-lb-prod-01', 'Brute Force Detection', 'Multiple failed login attempts from suspicious ASN', 'RU', 'edge-lb-prod-01', 'T1110'),
  ('00000000-0000-0000-0000-000000000002', NOW() - INTERVAL '1 hour', 'malware_detection', 'critical', 'CrowdStrike', '10.0.2.88', NULL, 'SYSTEM', 'ws-finance-12', 'Malware Prevention', 'Suspicious process rundll32.exe accessing LSASS memory', 'US', 'ws-finance-12', 'T1003'),
  ('00000000-0000-0000-0000-000000000002', NOW() - INTERVAL '30 minutes', 'privilege_escalation', 'critical', 'AWS CloudTrail', '52.94.1.1', '10.0.0.1', 'build-runner-44', 'aws-prod', 'IAM Anomaly', 'Privileged IAM role attached outside change window', 'US', 'aws-prod-root', 'T1078'),
  ('00000000-0000-0000-0000-000000000002', NOW() - INTERVAL '15 minutes', 'dns_anomaly', 'medium', 'Zscaler', '10.0.3.22', '8.8.8.8', 'j.okafor', 'laptop-eng-07', 'DGA Detection', 'High-entropy DNS query to newly registered domain', 'US', 'laptop-eng-07', 'T1071'),
  ('00000000-0000-0000-0000-000000000002', NOW() - INTERVAL '5 minutes', 'data_exfiltration', 'critical', 'DLP', '10.0.4.15', '198.51.100.88', 'a.chen', 'db-server-03', 'Data Exfiltration', 'Large outbound transfer to unknown external IP', 'US', 'db-server-03', 'T1041');

-- Sample alerts
INSERT INTO alerts (
  organization_id, title, description, severity, status,
  ai_priority_score, dedup_count, is_escalated, source_ip, mitre_technique
) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Brute Force — Okta SSO', '480 failed logins from AS208861 in 24h', 'high', 'new', 87, 480, false, '203.0.113.45', 'T1110'),
  ('00000000-0000-0000-0000-000000000002', 'LSASS Memory Access', 'rundll32.exe accessing LSASS on ws-finance-12', 'critical', 'triaging', 95, 1, true, '10.0.2.88', 'T1003'),
  ('00000000-0000-0000-0000-000000000002', 'IAM Role Anomaly', 'Privileged role attached outside change window', 'critical', 'escalated', 92, 3, true, '52.94.1.1', 'T1078');

-- Sample incident
INSERT INTO incidents (
  id, organization_id, incident_code, title, severity, status,
  category, affected_assets_count, affected_users_count, summary
) VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000002',
  'INC-1042',
  'Privileged IAM role attached outside change window',
  'high',
  'investigating',
  'Identity & Access',
  2,
  1,
  'Build-runner OIDC principal received admin role binding during maintenance freeze window.'
) ON CONFLICT (incident_code) DO NOTHING;

INSERT INTO incident_timeline (incident_id, timestamp, actor_type, actor_name, action_type, description) VALUES
  ('00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 hours', 'system', 'CloudTrail', 'detected', 'Anomalous IAM AttachRolePolicy event detected'),
  ('00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 hours', 'user', 'Amelia Lee', 'assigned', 'Incident assigned to SOC tier-2'),
  ('00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 hour', 'ai', 'NEXUS Copilot', 'analysis', 'Blast radius: aws-prod root + secrets-vault reachable');

INSERT INTO incident_recommendations (incident_id, content, order_index) VALUES
  ('00000000-0000-0000-0000-000000000100', 'Revoke role binding on build-runner-44 OIDC principal', 0),
  ('00000000-0000-0000-0000-000000000100', 'Rotate trust policy on aws-prod root account', 1),
  ('00000000-0000-0000-0000-000000000100', 'Force re-auth on all linked Okta identities', 2);

-- Sample endpoints
INSERT INTO endpoints (
  organization_id, hostname, os, agent_version, ip_address,
  is_isolated, risk_overall, risk_malware, risk_network, risk_credential, risk_behavior,
  session_count, tags, last_check_in
) VALUES
  ('00000000-0000-0000-0000-000000000002', 'ws-finance-12', 'windows', '7.2.1', '10.0.2.88', false, 78, 85, 45, 30, 60, 3, '["finance","crown-jewel"]', NOW() - INTERVAL '2 minutes'),
  ('00000000-0000-0000-0000-000000000002', 'edge-lb-prod-01', 'linux', '7.2.1', '10.0.1.50', false, 45, 20, 70, 15, 35, 12, '["production","edge"]', NOW() - INTERVAL '1 minute'),
  ('00000000-0000-0000-0000-000000000002', 'laptop-eng-07', 'macos', '7.1.8', '10.0.3.22', false, 55, 10, 40, 25, 50, 1, '["engineering"]', NOW() - INTERVAL '5 minutes');

-- Knowledge base article for RAG
INSERT INTO knowledge_articles (
  organization_id, author_id, title, slug, content, category, is_published
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000010',
  'IAM Role Anomaly Response Playbook',
  'iam-role-anomaly-response',
  'When a privileged IAM role is attached outside a change window: 1) Immediately revoke the role binding. 2) Audit CloudTrail for lateral movement. 3) Rotate trust policies. 4) Force re-authentication on linked identities. 5) Open incident and notify #soc-prod.',
  'Runbooks',
  true
) ON CONFLICT (organization_id, slug) DO NOTHING;
