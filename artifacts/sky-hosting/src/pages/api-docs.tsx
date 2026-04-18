import { useState } from "react";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

const BASE_URL = "https://sky-hosting.replit.app/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 text-white/30 hover:text-white/80 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative">
      <pre className={`bg-black/50 p-4 rounded-lg border border-white/5 font-mono text-xs overflow-x-auto leading-relaxed text-${language === "bash" ? "emerald" : "blue"}-200/90 whitespace-pre`}>
        {code}
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "text-blue-400 border-blue-400/30 bg-blue-400/5",
    POST: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
    DELETE: "text-red-400 border-red-400/30 bg-red-400/5",
  };
  return (
    <Badge variant="outline" className={`font-mono text-xs shrink-0 ${colors[method] ?? ""}`}>
      {method}
    </Badge>
  );
}

interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth: "none" | "read" | "write" | "admin";
  curl: string;
  body?: string;
  response: string;
}

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/healthz",
    description: "Check if the API is online. No authentication required.",
    auth: "none",
    curl: `curl ${BASE_URL}/healthz`,
    response: `{ "status": "ok" }`,
  },
  {
    method: "POST",
    path: "/v1/keys/generate",
    description: "Generate a new API key. Use the master key or an admin-scoped key to create new keys with read, write, or admin scope.",
    auth: "admin",
    curl: `curl -X POST ${BASE_URL}/v1/keys/generate \\
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-ci-bot",
    "scope": "write"
  }'`,
    response: `{
  "key": "<your-api-key>",
  "name": "my-ci-bot",
  "scope": "write",
  "createdAt": "2025-01-01T00:00:00.000Z"
}`,
  },
  {
    method: "GET",
    path: "/v1/projects",
    description: "List all projects in the system.",
    auth: "read",
    curl: `curl ${BASE_URL}/v1/projects \\
  -H "Authorization: Bearer <your-api-key>"`,
    response: `[
  {
    "id": "proj_abc123",
    "name": "My App",
    "status": "live",
    "runtime": "nodejs",
    "liveUrl": "https://sky-hosting.replit.app/preview/abc123/",
    "repoUrl": "https://github.com/you/your-repo",
    "deploymentCount": 3,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]`,
  },
  {
    method: "POST",
    path: "/v1/projects",
    description: "Create a new project. You only need to do this once per app — reuse the project ID for all future deployments.",
    auth: "write",
    curl: `curl -X POST ${BASE_URL}/v1/projects \\
  -H "Authorization: Bearer <your-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My App",
    "description": "Production API service",
    "repoUrl": "https://github.com/you/your-repo"
  }'`,
    response: `{
  "id": "proj_abc123",
  "name": "My App",
  "status": "idle",
  "runtime": "unknown",
  "liveUrl": null,
  "deploymentCount": 0,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}`,
  },
  {
    method: "GET",
    path: "/v1/projects/:id",
    description: "Get a single project. The liveUrl field always reflects the current live deployment.",
    auth: "read",
    curl: `curl ${BASE_URL}/v1/projects/proj_abc123 \\
  -H "Authorization: Bearer <your-api-key>"`,
    response: `{
  "id": "proj_abc123",
  "name": "My App",
  "status": "live",
  "runtime": "nodejs",
  "liveUrl": "https://sky-hosting.replit.app/preview/abc123/",
  "repoUrl": "https://github.com/you/your-repo",
  "deploymentCount": 3,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-02T00:00:00.000Z"
}`,
  },
  {
    method: "DELETE",
    path: "/v1/projects/:id",
    description: "Delete a project and all its associated deployments.",
    auth: "write",
    curl: `curl -X DELETE ${BASE_URL}/v1/projects/proj_abc123 \\
  -H "Authorization: Bearer <your-api-key>"`,
    response: `HTTP 204 No Content`,
  },
  {
    method: "POST",
    path: "/v1/deploy",
    description: "Trigger a new deployment for a project. The engine clones the repo, detects the runtime, installs dependencies, and starts the process. Poll the returned deployment ID for status updates.",
    auth: "write",
    curl: `curl -X POST ${BASE_URL}/v1/deploy \\
  -H "Authorization: Bearer <your-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "proj_abc123",
    "repoUrl": "https://github.com/you/your-repo",
    "branch": "main",
    "envVars": {
      "PORT": "3000",
      "NODE_ENV": "production"
    }
  }'`,
    response: `{
  "id": "dep_xyz789",
  "projectId": "proj_abc123",
  "projectName": "My App",
  "status": "queued",
  "runtime": "unknown",
  "branch": "main",
  "liveUrl": null,
  "repoUrl": "https://github.com/you/your-repo",
  "createdAt": "2025-01-01T00:00:00.000Z"
}`,
  },
  {
    method: "GET",
    path: "/v1/deployments",
    description: "List all deployments. Filter by project using the projectId query param.",
    auth: "read",
    curl: `# All deployments
curl ${BASE_URL}/v1/deployments \\
  -H "Authorization: Bearer <your-api-key>"

# Filter by project
curl "${BASE_URL}/v1/deployments?projectId=proj_abc123" \\
  -H "Authorization: Bearer <your-api-key>"`,
    response: `[
  {
    "id": "dep_xyz789",
    "projectId": "proj_abc123",
    "status": "live",
    "runtime": "nodejs",
    "liveUrl": "https://sky-hosting.replit.app/preview/dep_xyz789/",
    "branch": "main",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]`,
  },
  {
    method: "GET",
    path: "/v1/deployments/:id",
    description: "Get deployment details. Poll this endpoint until status becomes live or failed. Once live, the liveUrl is ready to use.",
    auth: "read",
    curl: `curl ${BASE_URL}/v1/deployments/dep_xyz789 \\
  -H "Authorization: Bearer <your-api-key>"`,
    response: `{
  "id": "dep_xyz789",
  "projectId": "proj_abc123",
  "projectName": "My App",
  "status": "live",
  "runtime": "nodejs",
  "branch": "main",
  "commitHash": "a1b2c3d",
  "liveUrl": "https://sky-hosting.replit.app/preview/dep_xyz789/",
  "repoUrl": "https://github.com/you/your-repo",
  "startedAt": "2025-01-01T00:00:00.000Z",
  "completedAt": "2025-01-01T00:01:23.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z"
}`,
  },
  {
    method: "DELETE",
    path: "/v1/deployments/:id",
    description: "Take down a live deployment. The process is killed and the URL stops responding.",
    auth: "write",
    curl: `curl -X DELETE ${BASE_URL}/v1/deployments/dep_xyz789 \\
  -H "Authorization: Bearer <your-api-key>"`,
    response: `HTTP 204 No Content`,
  },
  {
    method: "GET",
    path: "/v1/logs/:deploymentId",
    description: "Retrieve the full build and runtime log history for a deployment. For real-time streaming logs, use Socket.io instead.",
    auth: "read",
    curl: `curl ${BASE_URL}/v1/logs/dep_xyz789 \\
  -H "Authorization: Bearer <your-api-key>"`,
    response: `{
  "deploymentId": "dep_xyz789",
  "logs": [
    { "timestamp": "2025-01-01T00:00:01.000Z", "level": "info",    "message": "Cloning repository..." },
    { "timestamp": "2025-01-01T00:00:05.000Z", "level": "info",    "message": "Detected runtime: nodejs" },
    { "timestamp": "2025-01-01T00:00:06.000Z", "level": "info",    "message": "Running npm install..." },
    { "timestamp": "2025-01-01T00:01:10.000Z", "level": "success", "message": "Deployment is live" }
  ]
}`,
  },
  {
    method: "GET",
    path: "/v1/activity",
    description: "Get a feed of recent deployment events across all projects.",
    auth: "read",
    curl: `curl ${BASE_URL}/v1/activity \\
  -H "Authorization: Bearer <your-api-key>"`,
    response: `[
  {
    "id": "act_001",
    "type": "deployed",
    "projectName": "My App",
    "deploymentId": "dep_xyz789",
    "message": "My App deployed successfully",
    "timestamp": "2025-01-01T00:01:23.000Z"
  }
]`,
  },
  {
    method: "GET",
    path: "/v1/admin/stats",
    description: "Get system-wide statistics. Requires an admin-scoped key.",
    auth: "admin",
    curl: `curl ${BASE_URL}/v1/admin/stats \\
  -H "Authorization: Bearer YOUR_ADMIN_KEY"`,
    response: `{
  "totalProjects": 12,
  "totalDeployments": 47,
  "activeDeployments": 9,
  "failedDeployments": 3,
  "activeWebSocketConnections": 5,
  "serverLoad": 0.4,
  "uptime": 86400
}`,
  },
];

const authColors: Record<string, string> = {
  none: "text-white/40 border-white/10",
  read: "text-sky-400 border-sky-400/30 bg-sky-400/5",
  write: "text-amber-400 border-amber-400/30 bg-amber-400/5",
  admin: "text-purple-400 border-purple-400/30 bg-purple-400/5",
};

const authLabels: Record<string, string> = {
  none: "No Auth",
  read: "read key",
  write: "write key",
  admin: "admin key",
};

export default function ApiDocs() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "auth", label: "Authentication" },
    { id: "keys", label: "API Keys" },
    { id: "realtime", label: "Real-time Logs" },
    { id: "flow", label: "Integration Flow" },
    { id: "endpoints", label: "Endpoints" },
  ];

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-bold font-mono tracking-tight">API REFERENCE</h1>
        <p className="text-muted-foreground mt-2">Programmatic access to the Sky Hosting deployment engine.</p>
      </div>

      <div className="flex gap-8">
        {/* Sticky sidebar nav */}
        <aside className="hidden lg:block w-44 shrink-0">
          <div className="sticky top-6 space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActiveSection(s.id);
                }}
                className={`w-full text-left text-xs font-mono px-3 py-2 rounded transition-colors ${
                  activeSection === s.id
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 space-y-10 min-w-0">

          {/* Overview */}
          <section id="overview">
            <h2 className="text-lg font-bold font-mono text-white/90 mb-4">Overview</h2>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-4">
                <div>
                  <p className="text-xs text-white/40 font-mono uppercase tracking-wider mb-2">Base URL</p>
                  <div className="relative">
                    <pre className="bg-black/50 p-3 rounded-lg border border-white/5 font-mono text-sm text-emerald-300">
                      {BASE_URL}
                    </pre>
                    <CopyButton text={BASE_URL} />
                  </div>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  All API requests must be made over HTTPS. Every endpoint returns JSON. Successful responses use standard HTTP status codes (200, 201, 204). Errors return a JSON body with an <code className="font-mono text-xs bg-white/10 px-1 py-0.5 rounded">error</code> field explaining what went wrong.
                </p>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {[
                    { label: "Format", value: "JSON" },
                    { label: "Protocol", value: "HTTPS only" },
                    { label: "Real-time", value: "Socket.io" },
                  ].map((item) => (
                    <div key={item.label} className="bg-black/30 rounded-lg p-3 border border-white/5">
                      <p className="text-xs text-white/30 mb-1">{item.label}</p>
                      <p className="text-sm font-mono text-white/80">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Authentication */}
          <section id="auth">
            <h2 className="text-lg font-bold font-mono text-white/90 mb-4">Authentication</h2>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">
                  All protected endpoints require a Bearer token in the <code className="font-mono text-xs bg-white/10 px-1 py-0.5 rounded">Authorization</code> header.
                </p>
                <CodeBlock code={`Authorization: Bearer <your-api-key>`} language="text" />
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {[
                    { scope: "read", desc: "List projects, check deployment status, read logs" },
                    { scope: "write", desc: "Create projects, trigger & delete deployments" },
                    { scope: "admin", desc: "System stats, generate new keys of any scope" },
                  ].map((item) => (
                    <div key={item.scope} className="bg-black/30 rounded-lg p-3 border border-white/5">
                      <Badge variant="outline" className={`font-mono text-xs mb-2 ${authColors[item.scope]}`}>
                        {item.scope}
                      </Badge>
                      <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/30">
                  The master key <code className="font-mono text-xs bg-white/10 px-1 py-0.5 rounded">YOUR_ADMIN_KEY</code> has full admin access and can be found in the Admin panel.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* API Keys */}
          <section id="keys">
            <h2 className="text-lg font-bold font-mono text-white/90 mb-4">API Keys</h2>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">
                  Generate a key using the master key. Save the returned key — it is shown only once.
                </p>
                <CodeBlock code={`curl -X POST ${BASE_URL}/v1/keys/generate \\
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "my-ci-bot", "scope": "write" }'`} />
                <CodeBlock code={`{
  "key": "<your-api-key>",
  "name": "my-ci-bot",
  "scope": "write",
  "createdAt": "2025-01-01T00:00:00.000Z"
}`} language="json" />
              </CardContent>
            </Card>
          </section>

          {/* Real-time */}
          <section id="realtime">
            <h2 className="text-lg font-bold font-mono text-white/90 mb-4">Real-time Logs</h2>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">
                  Instead of polling for logs, connect via Socket.io to receive live build output as it happens.
                </p>
                <CodeBlock code={`npm install socket.io-client`} />
                <CodeBlock code={`import { io } from "socket.io-client";

const socket = io("https://sky-hosting.replit.app", {
  path: "/api/socket.io",
});

// Subscribe to a deployment's log stream
socket.emit("join-deployment", "dep_xyz789");

// Receive log lines in real time
socket.on("log", (entry) => {
  console.log(\`[\${entry.level}] \${entry.message}\`);
});

// Fired when the deployment finishes
socket.on("deployment-complete", (data) => {
  console.log("Status:", data.status);
  console.log("Live URL:", data.liveUrl);
});`} language="js" />
              </CardContent>
            </Card>
          </section>

          {/* Integration Flow */}
          <section id="flow">
            <h2 className="text-lg font-bold font-mono text-white/90 mb-4">Full Integration Flow</h2>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">
                  A complete example — create a project, deploy a repo, wait for it to go live, and retrieve the URL.
                </p>
                <CodeBlock code={`#!/bin/bash
API="${BASE_URL}"
KEY="<your-api-key>"

# 1. Create a project (one-time setup)
PROJECT=$(curl -s -X POST $API/v1/projects \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My App","repoUrl":"https://github.com/you/repo"}')
PROJECT_ID=$(echo $PROJECT | jq -r '.id')
echo "Project: $PROJECT_ID"

# 2. Trigger a deployment
DEPLOY=$(curl -s -X POST $API/v1/deploy \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d "{\\\"projectId\\\":\\\"$PROJECT_ID\\\",\\\"branch\\\":\\\"main\\\"}")
DEP_ID=$(echo $DEPLOY | jq -r '.id')
echo "Deployment started: $DEP_ID"

# 3. Poll until live or failed
while true; do
  STATUS=$(curl -s $API/v1/deployments/$DEP_ID \\
    -H "Authorization: Bearer $KEY")
  STATE=$(echo $STATUS | jq -r '.status')
  echo "Status: $STATE"

  if [ "$STATE" = "live" ]; then
    LIVE_URL=$(echo $STATUS | jq -r '.liveUrl')
    echo "Live at: $LIVE_URL"
    break
  elif [ "$STATE" = "failed" ]; then
    echo "Deployment failed"
    break
  fi
  sleep 5
done`} />
              </CardContent>
            </Card>
          </section>

          {/* Endpoints */}
          <section id="endpoints">
            <h2 className="text-lg font-bold font-mono text-white/90 mb-4">Endpoints</h2>
            <div className="space-y-4">
              {endpoints.map((ep, i) => (
                <Card key={i} className="glass-card border-white/10 bg-white/5 overflow-hidden">
                  <CardHeader className="bg-black/20 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <MethodBadge method={ep.method} />
                      <code className="font-mono text-sm text-white/90 flex-1">{BASE_URL}{ep.path}</code>
                      <Badge variant="outline" className={`font-mono text-xs ${authColors[ep.auth]}`}>
                        {authLabels[ep.auth]}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2 text-white/50 text-xs leading-relaxed">
                      {ep.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Example Request</p>
                      <CodeBlock code={ep.curl} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Response</p>
                      <CodeBlock code={ep.response} language="json" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
