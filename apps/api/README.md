# NEXUS API

Production Fastify REST + WebSocket API for the NEXUS SOC platform.

## Modules (all under `/v1`)

| Module | Routes | Permission |
|--------|--------|------------|
| Auth | `/auth/login`, `/auth/refresh`, `/auth/me` | public / auth |
| Events | `/events` | `view:events` |
| Incidents | `/incidents`, `/incidents/:id/status` | `view:incidents`, `act:incidents` |
| Alerts | `/alerts`, `/alerts/:id/acknowledge` | `view:alerts` |
| Copilot | `/copilot/sessions`, SSE messages | `view:copilot` |
| Dashboard | `/dashboard/stats` | `view:dashboard` |
| Endpoints | `/endpoints`, `/endpoints/:id/isolate` | `view:endpoints`, `act:incidents` |
| Vulnerabilities | `/vulnerabilities` | `view:vulnerabilities` |
| Threat Intel | `/threat-intel/actors`, `/threat-intel/iocs` | `view:threat-intel` |
| Cloud | `/cloud/accounts`, `/cloud/summary` | `view:cloud` |
| Network | `/network/flows`, `/network/dns` | `view:network` |
| Knowledge | `/knowledge`, `/knowledge/:id` | `view:knowledge` |
| Cases | `/cases` | `view:cases` |
| Investigations | `/investigations` | `view:investigations` |
| Compliance | `/compliance/assessments` | `view:compliance` |
| Reports | `/reports` | `view:reports` |
| Runbooks | `/runbooks` | `view:automation` |
| Attack Graphs | `/attack-graphs`, `/attack-graphs/:id` | `view:attack-graph` |
| Audit | `/audit` | `view:audit` |
| Platform Health | `/health/platform`, `/health/status` | `view:platform-health` |
| Developer | `/developer/api-keys`, `/developer/webhooks` | `view:developer` |
| Integrations | `/integrations` | `manage:integrations` |
| Organizations | `/orgs/current` | auth |
| Users | `/users`, `/users/identity-anomalies` | `manage:org`, `view:identity` |
| Search | `/search` | auth |
| Notifications | `/notifications` | `view:notifications` |
| WebSocket | `/ws/events?token=` | JWT query param |
| AI Scoring | `/ai/score/rescore` | `manage:settings` |

## Structure

```
src/
├── app.ts              # Fastify bootstrap
├── config/env.ts       # Zod env validation
├── lib/                # errors, tenant, route helpers
├── middleware/         # JWT auth + RBAC
├── modules/            # domain modules (service + routes)
├── plugins/            # audit log on mutations
└── scripts/            # migrate, hash-password
```

## Commands

```bash
npm run dev -w @nexus/api
npm run migrate -w @nexus/api
npm run seed:hash -w @nexus/api
```
