-- Seed demo organization data, admin user, and sample SOC data
-- Password for all demo users: NexusDemo2024! (also accepted without hash via API fallback)

INSERT INTO organizations (id, name, slug, industry, settings)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Acme Federal',
  'acme-federal',
  'Government',
  '{"llm_budget_monthly_usd": 500, "copilot_enabled": true}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO roles (id, organization_id, name, description, permissions, is_system) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'super_admin', 'Full platform control', '["*"]', true),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', 'security_admin', 'Operational admin', '["view:*","act:incidents","manage:integrations"]', true),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000002', 'soc_analyst', 'SOC analyst', '["view:dashboard","view:events","view:incidents","act:incidents","view:alerts","view:copilot"]', true),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000002', 'threat_hunter', 'Threat hunter', '["view:dashboard","view:events","view:threat-intel","view:copilot"]', true),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000002', 'incident_responder', 'Incident responder', '["view:incidents","act:incidents","view:copilot"]', true),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000002', 'compliance_officer', 'Compliance', '["view:compliance","view:audit","view:reports"]', true),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000002', 'viewer', 'Viewer', '["view:dashboard","view:events","view:incidents"]', true)
ON CONFLICT DO NOTHING;

INSERT INTO users (id, organization_id, role_id, email, full_name, password_hash, avatar_seed, workspace_name, status)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000102',
  'amelia.lee@acme.federal',
  'Amelia Lee',
  NULL,
  'amelia.lee@acme.federal',
  'Acme Federal',
  'active'
) ON CONFLICT (email) DO NOTHING;

-- Sample security events
INSERT INTO security_events (organization_id, event_timestamp, type, severity, source, source_ip, dest_ip, username, host, rule_name, message, country_code, asset, mitre_technique)
SELECT
  '00000000-0000-0000-0000-000000000002',
  NOW() - (n || ' minutes')::interval,
  (ARRAY['failed_login','malware_detection','suspicious_process','dns_anomaly','privilege_escalation','brute_force'])[1 + (n % 6)]::event_type,
  (ARRAY['critical','high','medium','info']::severity_level[])[1 + (n % 4)],
  'EDR-Sentinel',
  '10.0.' || (n % 255) || '.' || ((n * 7) % 255),
  '192.168.1.' || (n % 50),
  CASE WHEN n % 3 = 0 THEN 'svc-deploy' ELSE 'k.morgan' END,
  'edge-' || lpad(n::text, 4, '0'),
  'DET-' || lpad(n::text, 4, '0'),
  'Suspicious activity detected on endpoint edge-' || lpad(n::text, 4, '0'),
  'US',
  'prod-web-' || (n % 10),
  'T1078'
FROM generate_series(1, 50) AS n;

-- Sample alerts
INSERT INTO alerts (organization_id, title, description, severity, status, ai_priority_score, dedup_count, is_escalated, is_acknowledged, raw_trigger_data)
SELECT
  '00000000-0000-0000-0000-000000000002',
  'Alert: ' || (ARRAY['Brute Force','Malware','Privilege Escalation','Data Exfil'])[1 + (n % 4)],
  'Automated detection triggered for suspicious activity pattern #' || n,
  (ARRAY['critical','high','medium','low']::severity_level[])[1 + (n % 4)],
  (ARRAY['new','triaging','acknowledged']::alert_status[])[1 + (n % 3)],
  50 + (n * 7) % 50,
  1 + (n % 5),
  n % 7 = 0,
  n % 3 = 0,
  '{}'::jsonb
FROM generate_series(1, 20) AS n;

-- Sample incidents
INSERT INTO incidents (organization_id, incident_code, title, severity, status, category, affected_assets_count, affected_users_count, summary, opened_at)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'INC-1042', 'Privileged IAM role attached outside change window', 'high', 'investigating', 'Identity', 2, 3,
   'Build-runner OIDC role granted admin access to production secrets vault outside approved change window.', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000002', 'INC-1038', 'Ransomware precursor detected on edge fleet', 'critical', 'contained', 'Malware', 5, 0,
   'Multiple endpoints showing LSASS access via rundll32 — contained via network isolation.', NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000002', 'INC-1021', 'SSO brute-force campaign from BulletProof ASN', 'medium', 'open', 'Identity', 0, 12,
   'Coordinated login attempts against Okta from 7 newly-observed ASNs.', NOW() - INTERVAL '6 hours')
ON CONFLICT (incident_code) DO NOTHING;

INSERT INTO incident_timeline (incident_id, timestamp, actor_type, actor_name, action_type, description)
SELECT i.id, NOW() - INTERVAL '3 hours', 'user', 'Amelia Lee', 'status_change', 'Incident opened and assigned'
FROM incidents i WHERE i.incident_code = 'INC-1042';

INSERT INTO incident_recommendations (incident_id, content, order_index)
SELECT i.id, rec, idx FROM incidents i,
  unnest(ARRAY[
    'Revoke unauthorized IAM role binding immediately',
    'Rotate OIDC trust policy on build-runner',
    'Force re-authentication on linked identities',
    'Review CloudTrail for lateral movement'
  ]) WITH ORDINALITY AS t(rec, idx)
WHERE i.incident_code = 'INC-1042';

INSERT INTO knowledge_articles (organization_id, title, slug, content, category, is_published, tags)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'IAM Privilege Escalation Response', 'iam-priv-escalation',
   'When privileged IAM roles are attached outside change windows: 1) Revoke role immediately 2) Audit CloudTrail 3) Rotate credentials 4) Review OIDC trust policies.', 'Runbook', true, '["iam","aws","incident"]'),
  ('00000000-0000-0000-0000-000000000002', 'LSASS Access Detection', 'lsass-access-detection',
   'LSASS memory access via rundll32 indicates credential dumping (MITRE T1003). Isolate endpoint, collect memory dump, hunt for lateral movement.', 'Detection', true, '["edr","credential","mitre"]')
ON CONFLICT DO NOTHING;

INSERT INTO notifications (organization_id, user_id, type, severity, title, body, is_read)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000010',
  'incident_assigned',
  'high',
  'New incident assigned: INC-1042',
  'You have been assigned to investigate privileged IAM role escalation.',
  false
);
