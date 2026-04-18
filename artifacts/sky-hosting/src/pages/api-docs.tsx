import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function ApiDocs() {
  const endpoints = [
    {
      method: "GET",
      path: "/api/v1/projects",
      description: "List all deployed projects",
      response: "Array<Project>",
    },
    {
      method: "POST",
      path: "/api/v1/projects",
      description: "Create a new project",
      body: "{ name: string, description?: string, repoUrl?: string }",
      response: "Project",
    },
    {
      method: "GET",
      path: "/api/v1/projects/:id",
      description: "Get a specific project by ID",
      response: "Project",
    },
    {
      method: "POST",
      path: "/api/v1/deploy",
      description: "Trigger a new deployment",
      body: "{ projectId: string, repoUrl?: string, branch?: string, envVars?: Record<string, string> }",
      response: "Deployment",
    },
    {
      method: "GET",
      path: "/api/v1/deployments",
      description: "List deployments, optionally filtered by projectId",
      response: "Array<Deployment>",
    },
    {
      method: "GET",
      path: "/api/v1/deployments/:id",
      description: "Get deployment details",
      response: "Deployment",
    },
    {
      method: "GET",
      path: "/api/v1/deployments/:id/logs",
      description: "Get deployment logs",
      response: "DeploymentLogs",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      <div>
        <h1 className="text-3xl font-bold font-mono tracking-tight">API REFERENCE</h1>
        <p className="text-muted-foreground mt-2">Programmatic access to the Sky Hosting deployment engine.</p>
      </div>

      <div className="space-y-6">
        {endpoints.map((endpoint, i) => (
          <Card key={i} className="glass-card border-white/10 bg-white/5 overflow-hidden">
            <CardHeader className="bg-black/20 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge 
                    variant="outline" 
                    className={`font-mono text-xs ${
                      endpoint.method === "GET" ? "text-blue-400 border-blue-400/30" : "text-emerald-400 border-emerald-400/30"
                    }`}
                  >
                    {endpoint.method}
                  </Badge>
                  <code className="font-mono text-sm text-white/90">{endpoint.path}</code>
                </div>
              </div>
              <CardDescription className="mt-2 text-white/60">{endpoint.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {endpoint.body && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request Body</h4>
                  <pre className="bg-black/40 p-3 rounded border border-white/5 font-mono text-xs text-orange-200 overflow-x-auto">
                    {endpoint.body}
                  </pre>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Response</h4>
                <pre className="bg-black/40 p-3 rounded border border-white/5 font-mono text-xs text-blue-200 overflow-x-auto">
                  {endpoint.response}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}