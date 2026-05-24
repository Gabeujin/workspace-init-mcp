import { type GeneratedFile } from "../types.js";

export type ServerFlowDashboardFocus =
  | "network-traffic"
  | "workflow"
  | "lightweight"
  | "combined";

export interface ServerFlowDashboardParams {
  workspacePath: string;
  dashboardName?: string;
  applicationName?: string;
  focus?: ServerFlowDashboardFocus;
  monitoredServices?: string[];
  ports?: number[];
  dataPipelines?: string[];
}

function normalizeName(value: string | undefined, fallback: string): string {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function buildConfig(params: ServerFlowDashboardParams) {
  const focus = params.focus ?? "combined";
  return {
    schemaVersion: "1.0.0",
    dashboardDomain: "server-flow-monitoring",
    dashboardName: normalizeName(params.dashboardName, "Server Flow Monitoring Dashboard"),
    applicationName: normalizeName(params.applicationName, "Application Server"),
    focus,
    separationRule:
      "This dashboard monitors application/server flow only. It is not the World Model Harness Dashboard and must not own agent governance, project reality, goal compass, or context-rot state.",
    flowTypes: {
      networkTraffic:
        focus === "network-traffic" || focus === "combined"
          ? {
              enabled: true,
              metrics: [
                "throughputBps",
                "topTalkers",
                "protocolShare",
                "packetLossRate",
                "suspiciousPortOrIpSignals",
              ],
            }
          : { enabled: false, metrics: [] },
      workflow:
        focus === "workflow" || focus === "combined"
          ? {
              enabled: true,
              metrics: [
                "pipelineStatus",
                "queueLatencyMs",
                "jobThroughputPerMinute",
                "failedProcessCount",
                "retryCount",
              ],
            }
          : { enabled: false, metrics: [] },
      lightweightServer:
        focus === "lightweight" || focus === "combined"
          ? {
              enabled: true,
              metrics: [
                "cpuPercent",
                "memoryPercent",
                "diskPercent",
                "containerStatus",
                "uptimeStatus",
              ],
            }
          : { enabled: false, metrics: [] },
    },
    monitoredServices: params.monitoredServices ?? ["web", "api", "worker"],
    ports: params.ports ?? [80, 443, 3000],
    dataPipelines: params.dataPipelines ?? ["ingest", "process", "publish"],
    alertPolicy: {
      status: "draft",
      thresholds: {
        cpuPercent: 85,
        memoryPercent: 90,
        diskPercent: 90,
        packetLossRate: 0.02,
        queueLatencyMs: 30000,
        failedProcessCount: 1,
      },
      notificationTargets: [],
    },
    modernWebUiPolicy: {
      sourceBaseline: "Google I/O 2026 Chrome UI and HTML-in-Canvas guidance",
      progressiveEnhancement:
        "Use modern UI APIs only when the dashboard keeps a stable semantic DOM fallback and passes browser QA.",
      preferredPrimitives: [
        "View Transitions",
        "scroll-driven animations",
        "popover/dialog/inert",
        "container queries",
        "color-scheme",
        "light-dark()",
        "reduced-motion media queries",
      ],
      htmlInCanvasPolicy:
        "Allowed for topology or traffic visualizations only when text remains accessible, searchable, translatable, and keyboard-testable outside bitmap-only rendering.",
    },
  };
}

function buildSampleSnapshot(params: ServerFlowDashboardParams) {
  const services = params.monitoredServices ?? ["web", "api", "worker"];
  const pipelines = params.dataPipelines ?? ["ingest", "process", "publish"];
  return {
    generatedAt: "sample",
    status: "sample-data",
    networkTraffic: {
      throughputBps: 1250000,
      packetLossRate: 0.001,
      topTalkers: [
        { ip: "10.0.0.24", role: "client", bytesPerSecond: 620000 },
        { ip: "10.0.1.10", role: "server", bytesPerSecond: 410000 },
      ],
      protocolShare: [
        { protocol: "HTTPS", percent: 78 },
        { protocol: "HTTP", percent: 12 },
        { protocol: "Other", percent: 10 },
      ],
    },
    workflow: {
      pipelines: pipelines.map((name, index) => ({
        name,
        status: index === 0 ? "running" : "waiting",
        queueLatencyMs: 1200 + index * 900,
        throughputPerMinute: 18 - index * 3,
        failedProcessCount: index === pipelines.length - 1 ? 1 : 0,
      })),
    },
    lightweightServer: {
      cpuPercent: 37,
      memoryPercent: 54,
      diskPercent: 61,
      uptimeStatus: "up",
      services: services.map((name, index) => ({
        name,
        status: index === services.length - 1 ? "degraded" : "up",
        port: (params.ports ?? [80, 443, 3000])[index] ?? null,
      })),
    },
  };
}

function buildReadme(params: ServerFlowDashboardParams): string {
  const config = buildConfig(params);
  return `# ${config.dashboardName}

This is a Server Flow Monitoring Dashboard scaffold for ${config.applicationName}.

It is intentionally separate from the World Model Harness Dashboard:

- World Model Harness Dashboard: agent continuity, project reality, goal direction, context rot, governance, evidence, and handoff.
- Server Flow Monitoring Dashboard: application/server traffic, workflow, resource, service, and uptime monitoring.

## Flow Areas

- Network traffic flow: throughput, top talkers, protocol share, packet loss, suspicious ports or IPs.
- Data and workflow flow: pipeline state, queue latency, job throughput, failures, retries.
- Lightweight server flow: CPU, memory, disk, containers or services, domains, uptime.

## Files

- \`config/server-flow-dashboard.config.json\`: monitored services, ports, flow domains, and alert thresholds.
- \`data/sample-flow-snapshot.json\`: sample payload shape for early UI wiring.
- \`public/index.html\`: static dashboard shell.
- \`public/app.js\`: local sample renderer.
- \`public/styles.css\`: responsive dashboard styling.

## Next Integration Steps

1. Replace sample data with a read-only metrics endpoint or exported JSON snapshot.
2. Keep secrets, tokens, customer payloads, and raw credentials out of dashboard state.
3. Record alert thresholds and ownership before using the dashboard for operations.
4. Link the dashboard from application runbooks, not from the World Model Harness state.
5. Use modern browser UI APIs as progressive enhancement only after Playwright, keyboard, accessibility, console, and responsive checks pass.
`;
}

function buildHtml(params: ServerFlowDashboardParams): string {
  const title = escapeHtml(normalizeName(params.dashboardName, "Server Flow Monitoring Dashboard"));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Server Flow Monitoring</p>
        <h1>${title}</h1>
        <p id="data-source-status" class="source" aria-live="polite">sample snapshot loaded</p>
      </div>
      <div class="topbar-actions">
        <button id="refresh-sample" type="button">Refresh sample</button>
        <span id="overall-status" class="status-pill">sample</span>
      </div>
    </header>

    <section class="summary-grid" aria-label="Server flow summary">
      <article class="metric-card">
        <span>Throughput</span>
        <strong id="throughput">--</strong>
        <small>network traffic</small>
      </article>
      <article class="metric-card">
        <span>Queue latency</span>
        <strong id="queue-latency">--</strong>
        <small>workflow</small>
      </article>
      <article class="metric-card">
        <span>CPU</span>
        <strong id="cpu">--</strong>
        <small>host resource</small>
      </article>
      <article class="metric-card">
        <span>Services</span>
        <strong id="service-count">--</strong>
        <small>uptime</small>
      </article>
    </section>

    <section class="panel-grid">
      <section class="panel">
        <h2>Network Traffic Flow</h2>
        <div id="top-talkers" class="stack"></div>
      </section>
      <section class="panel">
        <h2>Data And Workflow Flow</h2>
        <div id="pipelines" class="stack"></div>
      </section>
      <section class="panel">
        <h2>Lightweight Server State</h2>
        <div id="services" class="stack"></div>
      </section>
    </section>
  </main>
  <script src="./app.js"></script>
</body>
</html>
`;
}

function buildStyles(): string {
  return `:root {
  color-scheme: light;
  --bg: #f7f8fb;
  --surface: #ffffff;
  --ink: #172033;
  --muted: #627086;
  --line: #d8deea;
  --accent: #0b766f;
  --warn: #a15c00;
  --bad: #b42318;
}

* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); }
.shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 40px; }
.topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 18px; }
.topbar-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 10px; }
.eyebrow { margin: 0 0 6px; color: var(--accent); font-weight: 700; text-transform: uppercase; font-size: 0.78rem; letter-spacing: 0; }
h1 { margin: 0; font-size: 2rem; line-height: 1.15; }
h2 { margin: 0 0 14px; font-size: 1rem; }
.status-pill { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 8px 12px; color: var(--muted); font-weight: 700; }
.source { margin: 8px 0 0; color: var(--muted); font-size: 0.85rem; }
button { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 8px 10px; font-weight: 700; cursor: pointer; }
button:hover { border-color: var(--accent); color: var(--accent); }
.summary-grid, .panel-grid { display: grid; gap: 14px; }
.summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 14px; }
.panel-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.metric-card, .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
.metric-card { min-height: 118px; display: grid; gap: 8px; }
.metric-card span, .row span { color: var(--muted); }
.metric-card strong { font-size: 1.8rem; }
.stack { display: grid; gap: 10px; }
.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
.row:first-child { border-top: 0; }
.badge { border-radius: 999px; padding: 4px 8px; background: #eef7f5; color: var(--accent); font-weight: 700; }
.badge.warn { background: #fff4df; color: var(--warn); }
.badge.bad { background: #ffebe8; color: var(--bad); }

@media (max-width: 820px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .topbar-actions { justify-content: flex-start; }
  .summary-grid, .panel-grid { grid-template-columns: 1fr; }
}
`;
}

function buildAppJs(snapshot: unknown): string {
  const fallback = JSON.stringify(snapshot, null, 2);
  return `const fallbackSnapshot = ${fallback};

function formatBytesPerSecond(value) {
  const mbps = Number(value || 0) * 8 / 1000000;
  return mbps.toFixed(1) + " Mbps";
}

function badgeClass(status) {
  const value = String(status || "unknown");
  return value === "up" || value === "running" ? "badge" : value === "degraded" || value === "waiting" ? "badge warn" : "badge bad";
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function appendRow(container, label, value, options = {}) {
  const row = document.createElement("div");
  row.className = "row";
  const labelNode = document.createElement("span");
  labelNode.textContent = String(label);
  const valueNode = document.createElement("strong");
  if (options.badgeStatus) {
    const badge = document.createElement("span");
    badge.className = badgeClass(options.badgeStatus);
    badge.textContent = String(options.badgeStatus);
    valueNode.appendChild(badge);
    if (value) {
      valueNode.appendChild(document.createTextNode(" " + String(value)));
    }
  } else {
    valueNode.textContent = String(value);
  }
  row.appendChild(labelNode);
  row.appendChild(valueNode);
  container.appendChild(row);
}

function renderRows(containerId, items, renderItem, emptyLabel) {
  const container = document.getElementById(containerId);
  clearNode(container);
  if (!items.length) {
    appendRow(container, emptyLabel, "--");
    return;
  }
  items.forEach((item) => renderItem(container, item));
}

function render(snapshot) {
  const network = snapshot.networkTraffic || {};
  const workflow = snapshot.workflow || {};
  const server = snapshot.lightweightServer || {};
  const pipelines = Array.isArray(workflow.pipelines) ? workflow.pipelines : [];
  const services = Array.isArray(server.services) ? server.services : [];

  document.getElementById("overall-status").textContent = snapshot.status || "unknown";
  document.getElementById("throughput").textContent = formatBytesPerSecond(network.throughputBps);
  document.getElementById("queue-latency").textContent = pipelines.length ? Math.max(...pipelines.map((item) => Number(item.queueLatencyMs || 0))) + " ms" : "--";
  document.getElementById("cpu").textContent = Number(server.cpuPercent || 0) + "%";
  document.getElementById("service-count").textContent = services.filter((item) => item.status === "up").length + "/" + services.length;
  document.getElementById("data-source-status").textContent = "sample snapshot refreshed at " + new Date().toLocaleTimeString();

  renderRows(
    "top-talkers",
    Array.isArray(network.topTalkers) ? network.topTalkers : [],
    (container, item) => appendRow(container, String(item.ip || "unknown") + " " + String(item.role || ""), formatBytesPerSecond(item.bytesPerSecond)),
    "No network samples"
  );
  renderRows(
    "pipelines",
    pipelines,
    (container, item) => appendRow(container, item.name || "pipeline", String(item.queueLatencyMs || 0) + " ms", { badgeStatus: item.status || "unknown" }),
    "No pipelines"
  );
  renderRows(
    "services",
    services,
    (container, item) => appendRow(container, String(item.name || "service") + (item.port ? ":" + String(item.port) : ""), "", { badgeStatus: item.status || "unknown" }),
    "No services"
  );
}

render(fallbackSnapshot);
document.getElementById("refresh-sample").addEventListener("click", () => {
  render(Object.assign({}, fallbackSnapshot, { status: "sample-refreshed" }));
});
`;
}

function buildGuide(params: ServerFlowDashboardParams): string {
  const config = buildConfig(params);
  return `# Server Flow Monitoring Dashboard Blueprint

Use this blueprint only when the user asks for application/server monitoring or when the current work creates an app, API server, MCP server, worker, data pipeline, or deployment that needs runtime visibility.

## Domain Boundary

- This is not the World Model Harness Dashboard.
- This dashboard does not own AI-agent governance, project goals, context rot, evidence ledgers, or handoff state.
- It owns application flow observability: network traffic, data/workflow execution, resources, service status, and uptime.

## Modern UI Rule

- Prefer native DOM, CSS, and progressive enhancement.
- Use HTML-in-Canvas only for topology or traffic visualizations that keep accessible, searchable, translatable DOM fallback.
- Keep View Transitions, scroll-driven animations, and form-factor gestures behind QA-friendly fallbacks.

## Starting Mode

- Dashboard: ${config.dashboardName}
- Application: ${config.applicationName}
- Focus: ${config.focus}

## Recommended Metrics

- Network traffic flow: bandwidth, top talkers, protocol share, packet loss, suspicious port or IP activity.
- Data and workflow flow: pipeline status, queue latency, processing throughput, failures, retries.
- Lightweight server state: CPU, memory, disk, containers or services, domain connections, uptime.
`;
}

export function generateServerFlowDashboardFiles(
  params: ServerFlowDashboardParams
): GeneratedFile[] {
  const config = buildConfig(params);
  const snapshot = buildSampleSnapshot(params);
  return [
    {
      relativePath: "server-flow-dashboard/README.md",
      content: buildReadme(params),
    },
    {
      relativePath: "server-flow-dashboard/config/server-flow-dashboard.config.json",
      content: `${JSON.stringify(config, null, 2)}\n`,
    },
    {
      relativePath: "server-flow-dashboard/data/sample-flow-snapshot.json",
      content: `${JSON.stringify(snapshot, null, 2)}\n`,
    },
    {
      relativePath: "server-flow-dashboard/public/index.html",
      content: buildHtml(params),
    },
    {
      relativePath: "server-flow-dashboard/public/styles.css",
      content: buildStyles(),
    },
    {
      relativePath: "server-flow-dashboard/public/app.js",
      content: buildAppJs(snapshot),
    },
    {
      relativePath: "docs/server-flow-monitoring-dashboard.md",
      content: buildGuide(params),
    },
  ];
}
