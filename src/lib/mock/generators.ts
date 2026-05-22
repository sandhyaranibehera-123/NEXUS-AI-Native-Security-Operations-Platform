import { faker } from "@faker-js/faker";
import type {
  EventType,
  Incident,
  IncidentStatus,
  MetricPoint,
  SecurityEvent,
  Severity,
} from "./types";

// Deterministic so demo data stays stable per session
faker.seed(42);

const SEVERITIES: Severity[] = ["critical", "high", "medium", "info", "healthy"];
const EVENT_TYPES: EventType[] = [
  "failed_login",
  "malware_detection",
  "suspicious_process",
  "dns_anomaly",
  "privilege_escalation",
  "suspicious_api",
  "iam_change",
  "data_exfiltration",
  "brute_force",
  "ransomware",
];

const RULES = [
  "EDR-1042: Suspicious child process spawned by Office",
  "AUTH-220: Repeated failed logins from new ASN",
  "CLOUD-IAM-9: Wildcard policy attached to user",
  "DNS-77: DGA-like query pattern",
  "NET-512: Outbound to known C2 infrastructure",
  "EDR-2001: LSASS memory access via non-system binary",
  "RANSOM-31: Mass file rename burst on endpoint",
  "K8S-14: Privileged container deployed to prod namespace",
];

const MITRE = [
  "T1078 Valid Accounts",
  "T1059 Command and Scripting Interpreter",
  "T1486 Data Encrypted for Impact",
  "T1071 Application Layer Protocol",
  "T1003 OS Credential Dumping",
  "T1110 Brute Force",
  "T1190 Exploit Public-Facing Application",
  "T1567 Exfiltration Over Web Service",
];

const COUNTRIES = ["US", "DE", "BR", "RU", "CN", "IN", "NG", "GB", "FR", "KP", "IR", "VN"];
const SOURCES = ["edr-falconlite", "okta", "aws-cloudtrail", "azure-ad", "zeek", "suricata", "k8s-audit", "github-audit"];

function severityFor(type: EventType): Severity {
  switch (type) {
    case "ransomware":
    case "data_exfiltration":
    case "privilege_escalation":
      return faker.helpers.weightedArrayElement([
        { weight: 6, value: "critical" },
        { weight: 3, value: "high" },
        { weight: 1, value: "medium" },
      ]);
    case "malware_detection":
    case "brute_force":
    case "suspicious_process":
      return faker.helpers.weightedArrayElement([
        { weight: 2, value: "critical" },
        { weight: 5, value: "high" },
        { weight: 3, value: "medium" },
      ]);
    case "iam_change":
    case "suspicious_api":
    case "dns_anomaly":
      return faker.helpers.weightedArrayElement([
        { weight: 1, value: "high" },
        { weight: 4, value: "medium" },
        { weight: 5, value: "info" },
      ]);
    case "failed_login":
    default:
      return faker.helpers.weightedArrayElement([
        { weight: 1, value: "high" },
        { weight: 3, value: "medium" },
        { weight: 6, value: "info" },
      ]);
  }
}

export function makeEvent(at: Date = new Date()): SecurityEvent {
  const type = faker.helpers.arrayElement(EVENT_TYPES);
  const severity = severityFor(type);
  const user = faker.internet.username().toLowerCase();
  const host = `${faker.helpers.arrayElement(["edge", "api", "db", "k8s", "win", "mac"])}-${faker.string.alphanumeric(6).toLowerCase()}`;
  return {
    id: faker.string.uuid(),
    timestamp: at.toISOString(),
    type,
    severity,
    source: faker.helpers.arrayElement(SOURCES),
    sourceIp: faker.internet.ipv4(),
    destIp: faker.internet.ipv4(),
    user,
    host,
    rule: faker.helpers.arrayElement(RULES),
    message: messageFor(type, user, host),
    country: faker.helpers.arrayElement(COUNTRIES),
    asset: `asset-${faker.string.alphanumeric(8).toLowerCase()}`,
    mitre: faker.helpers.arrayElement(MITRE),
    raw: {
      process: faker.system.fileName(),
      pid: faker.number.int({ min: 100, max: 99999 }),
      parent: faker.system.fileName(),
      cmdline: `/usr/bin/${faker.hacker.verb()} --${faker.hacker.adjective()} ${faker.system.filePath()}`,
      hash: faker.git.commitSha(),
      session: faker.string.uuid(),
    },
  };
}

function messageFor(type: EventType, user: string, host: string): string {
  switch (type) {
    case "failed_login": return `Failed login for ${user} on ${host}`;
    case "malware_detection": return `Trojan.GenericKD detected on ${host}`;
    case "suspicious_process": return `Unsigned binary spawned by winword.exe on ${host}`;
    case "dns_anomaly": return `High-entropy DNS queries from ${host}`;
    case "privilege_escalation": return `${user} elevated to domain admin on ${host}`;
    case "suspicious_api": return `Anomalous API token usage by ${user}`;
    case "iam_change": return `Wildcard IAM policy attached to ${user}`;
    case "data_exfiltration": return `Large outbound transfer from ${host} to external host`;
    case "brute_force": return `Credential stuffing burst targeting ${user}`;
    case "ransomware": return `Mass file encryption observed on ${host}`;
  }
}

export function makeEvents(n: number, spanMinutes = 60 * 24): SecurityEvent[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const at = new Date(now - faker.number.int({ min: 0, max: spanMinutes * 60_000 }) - i * 50);
    return makeEvent(at);
  }).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

const INCIDENT_TITLES = [
  "Suspected ransomware activity on prod fileserver",
  "Credential stuffing campaign against Okta tenant",
  "Privileged IAM role attached outside change window",
  "Anomalous data egress from EU analytics cluster",
  "C2 beaconing detected from build agent",
  "LSASS dump attempt on finance workstation",
  "Public S3 bucket exposed with PII",
  "Kubernetes API audit anomaly in payments namespace",
  "Impossible travel for executive account",
  "SQL injection probes on customer portal",
];

const CATEGORIES = ["Endpoint", "Identity", "Cloud", "Network", "Application", "Data"];
const ANALYSTS = ["amelia.lee", "j.okafor", "h.tanaka", "marco.cruz", "n.patel", "s.ivanov"];

export function makeIncident(i: number): Incident {
  const severity = faker.helpers.weightedArrayElement<Severity>([
    { weight: 2, value: "critical" },
    { weight: 4, value: "high" },
    { weight: 4, value: "medium" },
    { weight: 2, value: "info" },
  ]);
  const status = faker.helpers.weightedArrayElement<IncidentStatus>([
    { weight: 4, value: "open" },
    { weight: 3, value: "investigating" },
    { weight: 2, value: "contained" },
    { weight: 2, value: "resolved" },
  ]);
  const openedAt = faker.date.recent({ days: 14 });
  const updatedAt = faker.date.between({ from: openedAt, to: new Date() });
  const title = faker.helpers.arrayElement(INCIDENT_TITLES);
  const assignee = faker.helpers.arrayElement(ANALYSTS);
  const code = `INC-${(1000 + i).toString()}`;
  const timeline = Array.from({ length: faker.number.int({ min: 3, max: 7 }) }, () => ({
    at: faker.date.between({ from: openedAt, to: updatedAt }).toISOString(),
    actor: faker.helpers.arrayElement([...ANALYSTS, "nexus-ai", "edr-sensor", "siem-correlator"]),
    action: faker.helpers.arrayElement([
      "Triaged alert",
      "Correlated with related events",
      "Isolated endpoint",
      "Revoked session tokens",
      "Escalated to tier 2",
      "Applied containment policy",
      "Queried threat intel feed",
      "Added comment",
    ]),
    detail: faker.lorem.sentence(),
  })).sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return {
    id: faker.string.uuid(),
    code,
    title,
    severity,
    status,
    assignee,
    openedAt: openedAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    affectedAssets: faker.number.int({ min: 1, max: 42 }),
    affectedUsers: faker.number.int({ min: 0, max: 12 }),
    category: faker.helpers.arrayElement(CATEGORIES),
    mitre: faker.helpers.arrayElements(MITRE, { min: 1, max: 3 }),
    summary:
      "NEXUS correlated multiple high-severity signals across endpoint, identity, and network telemetry consistent with the early stages of an active intrusion. Containment actions are recommended.",
    timeline,
    rca: faker.lorem.paragraph(),
    recommendations: [
      "Isolate affected hosts from the network",
      "Force re-authentication for impacted identities",
      "Rotate credentials and API tokens",
      "Block indicators at perimeter and EDR",
    ],
    linkedEventIds: Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () => faker.string.uuid()),
  };
}

export function makeIncidents(n: number): Incident[] {
  return Array.from({ length: n }, (_, i) => makeIncident(i)).sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
  );
}

export function makeMetricSeries(points = 48, base = 50, jitter = 30): MetricPoint[] {
  const now = Date.now();
  let v = base;
  return Array.from({ length: points }, (_, i) => {
    v = Math.max(0, v + faker.number.int({ min: -jitter, max: jitter }));
    return { t: now - (points - i) * 60_000, v };
  });
}

// Singletons for the session — keeps data stable across nav.
export const SEED_EVENTS = makeEvents(800);
export const SEED_INCIDENTS = makeIncidents(28);
