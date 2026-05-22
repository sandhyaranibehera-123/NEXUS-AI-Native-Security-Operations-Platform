# NEXUS Roadmap

## Phase 1 — Foundation ✅ (shipped)
Design system, app shell, mock auth + RBAC, realtime simulator, Dashboard,
Events SIEM explorer, Incidents list + detail, Inspector drawer.

## Phase 2 — Detection surfaces
- [ ] `/threat-intelligence` — IOC feeds, malware hashes, CVE list, actor profiles
- [ ] `/endpoints` — inventory, process trees, isolate/quarantine actions
- [ ] `/identity` — risky users, impossible-travel map, MFA anomalies
- [ ] `/cloud-security` — AWS/Azure/GCP posture, exposed buckets, IAM findings
- [ ] `/vulnerabilities` — CVE table with CVSS/EPSS, patch status
- [ ] `/network` — flow analytics, geo attack map, DNS analytics

## Phase 3 — Investigation tools
- [ ] `/attack-graph` — force-directed graph w/ blast radius (cytoscape or d3-force)
- [ ] `/copilot` — AI chat surface: incident summaries, NL-to-query, remediation suggestions
- [ ] `/alerts` — alert center w/ ack/suppress/escalate

## Phase 4 — Governance
- [ ] `/compliance` — SOC2 / ISO27001 / HIPAA / GDPR / PCI scoring + evidence
- [ ] `/audit` — admin action log
- [ ] `/integrations` — Slack/Teams/GitHub/AWS/etc. integration hub
- [ ] `/organizations` — workspace switcher, invites, RBAC management
- [ ] `/settings` — API keys, webhooks, retention, notification preferences

## Phase 5 — Backend
- [ ] Real auth via Lovable Cloud (email/password + Google OAuth)
- [ ] Replace mock generators with server functions
- [ ] Wire TanStack Query loaders
- [ ] Real websocket stream for events
- [ ] Persisted incidents + comments

## Tech debt
- [ ] Table virtualization once event count exceeds ~2k visible rows
- [ ] Storybook for the design system primitives
- [ ] Playwright smoke tests for the auth gate + inspector
