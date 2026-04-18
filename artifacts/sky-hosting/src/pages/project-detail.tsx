import { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { 
  useGetProject, 
  useListDeployments, 
  useTriggerDeployment,
  useGetDeploymentLogs,
  getGetProjectQueryKey,
  getListDeploymentsQueryKey,
  getGetDeploymentLogsQueryKey,
  Project,
  Deployment,
  LogEntry
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, Activity, Globe, Github, Clock, GitBranch, Terminal, Copy, ExternalLink, Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id || "";
  
  const { data: project, isLoading: loadingProject } = useGetProject(projectId, { 
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) } 
  });
  
  const { data: deployments, isLoading: loadingDeployments } = useListDeployments(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getListDeploymentsQueryKey({ projectId }) } }
  );

  const activeDeployment = deployments?.[0]; // Assuming latest is first
  
  const [activeTab, setActiveTab] = useState("logs");
  const triggerDeployment = useTriggerDeployment();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeploy = () => {
    if (!project) return;
    
    triggerDeployment.mutate({ data: { projectId: project.id } }, {
      onSuccess: () => {
        toast({ title: "Deployment Initiated", description: "Firing up the thrusters." });
        queryClient.invalidateQueries({ queryKey: getListDeploymentsQueryKey({ projectId }) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        setActiveTab("logs");
      },
      onError: () => {
        toast({ title: "Deployment Failed", description: "Could not initiate launch sequence.", variant: "destructive" });
      }
    });
  };

  const copyUrl = (url?: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied to clipboard", description: url });
  };

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-700 max-w-6xl mx-auto">
      {loadingProject ? (
        <Skeleton className="h-32 glass-card rounded-xl" />
      ) : project ? (
        <div className="glass-card border-white/10 bg-white/5 p-6 md:p-8 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{project.name}</h1>
                {project.status === "live" && (
                  <Badge variant="outline" className="neon-border-green neon-text-green bg-[#00FF41]/10 px-3 py-1 rounded-full font-mono tracking-widest text-xs uppercase">
                    LIVE
                  </Badge>
                )}
                {project.status === "building" && (
                  <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full font-mono tracking-widest text-xs uppercase animate-pulse">
                    BUILDING
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-mono">
                {project.repoUrl && (
                  <a href={project.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <Github className="w-4 h-4" /> {project.repoUrl.split('/').slice(-2).join('/')}
                  </a>
                )}
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4" /> {project.runtime}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                </div>
              </div>

              {project.liveUrl && (
                <div className="flex items-center gap-2 mt-4 bg-black/40 p-2 pl-4 rounded-lg border border-white/10 w-fit">
                  <Globe className="w-4 h-4 text-[#00FF41]" />
                  <a href={project.liveUrl} target="_blank" rel="noreferrer" className="font-mono text-sm text-blue-300 hover:underline">
                    {project.liveUrl}
                  </a>
                  <div className="w-px h-4 bg-white/20 mx-2" />
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10" onClick={() => copyUrl(project.liveUrl)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button 
                onClick={handleDeploy}
                disabled={triggerDeployment.isPending || project.status === "building"}
                className="bg-white/10 hover:bg-blue-500/20 text-white hover:text-blue-300 border border-white/10 hover:border-blue-500/50 font-mono tracking-widest uppercase"
              >
                <Play className="w-4 h-4 mr-2" /> Trigger Deploy
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-red-400">Project not found</div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/5 border border-white/10 w-full justify-start p-1 h-auto rounded-lg">
          <TabsTrigger value="logs" className="font-mono uppercase tracking-wider text-xs py-2 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <Terminal className="w-4 h-4 mr-2" /> Live Terminal
          </TabsTrigger>
          <TabsTrigger value="history" className="font-mono uppercase tracking-wider text-xs py-2 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <Activity className="w-4 h-4 mr-2" /> Deployment History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="logs" className="mt-6">
          <Card className="border border-white/10 bg-[#050914] overflow-hidden shadow-2xl">
            <CardHeader className="border-b border-white/5 bg-white/[0.02] py-3 px-4 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-mono font-medium text-white/80">SYSTEM LOGS</CardTitle>
                {activeDeployment && (
                  <Badge variant="outline" className="ml-2 bg-white/5 border-white/10 text-xs font-mono">
                    {activeDeployment.id.substring(0, 8)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${activeDeployment?.status === "building" ? "bg-blue-500 animate-pulse" : "bg-muted-foreground"}`} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activeDeployment ? (
                <LiveTerminal deploymentId={activeDeployment.id} initialStatus={activeDeployment.status} />
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground font-mono text-sm">
                  No active deployment to monitor.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="mt-6">
          <Card className="glass-card border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="font-mono">MISSION LOG</CardTitle>
              <CardDescription>Historical deployment records</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDeployments ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 bg-white/5" />)}
                </div>
              ) : deployments?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No deployments found.</div>
              ) : (
                <div className="space-y-0 divide-y divide-white/5">
                  {deployments?.map((deploy: Deployment) => (
                    <div key={deploy.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          {deploy.status === "live" && <CheckCircle2 className="w-5 h-5 text-[#00FF41]" />}
                          {deploy.status === "failed" && <AlertTriangle className="w-5 h-5 text-red-500" />}
                          {deploy.status === "building" && <Activity className="w-5 h-5 text-blue-500 animate-pulse" />}
                          {["queued", "cloning", "detecting", "deploying"].includes(deploy.status) && <Clock className="w-5 h-5 text-yellow-500" />}
                          {deploy.status === "taken_down" && <XCircle className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-white">{deploy.id.substring(0, 8)}</span>
                            <Badge variant="outline" className={`font-mono text-[10px] uppercase border-white/10 bg-white/5 ${
                              deploy.status === 'live' ? 'text-[#00FF41]' : 
                              deploy.status === 'failed' ? 'text-red-400' : 'text-blue-400'
                            }`}>
                              {deploy.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                            {deploy.branch && (
                              <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {deploy.branch}</span>
                            )}
                            {deploy.commitHash && (
                              <span className="flex items-center gap-1"><Github className="w-3 h-3" /> {deploy.commitHash.substring(0, 7)}</span>
                            )}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(deploy.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {deploy.liveUrl && (
                          <a href={deploy.liveUrl} target="_blank" rel="noreferrer" className="p-2 bg-white/5 hover:bg-white/10 rounded-md text-blue-300 transition-colors" title="Visit Live URL">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Subcomponent for terminal
function LiveTerminal({ deploymentId, initialStatus }: { deploymentId: string, initialStatus: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState(initialStatus);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: initialLogs } = useGetDeploymentLogs(deploymentId, {
    query: { enabled: !!deploymentId, queryKey: getGetDeploymentLogsQueryKey(deploymentId) }
  });

  useEffect(() => {
    if (initialLogs?.logs) {
      setLogs(initialLogs.logs);
    }
  }, [initialLogs]);

  useEffect(() => {
    // Auto-scroll
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!deploymentId) return;

    const socket = io(window.location.origin, { path: "/api/socket.io" });
    
    socket.on("connect", () => {
      socket.emit("subscribe:deployment", { deploymentId });
    });

    socket.on("deployment:log", (data: { deploymentId: string, log: LogEntry }) => {
      if (data.deploymentId === deploymentId) {
        setLogs(prev => [...prev, data.log]);
      }
    });

    socket.on("deployment:status", (data: { deploymentId: string, status: string }) => {
      if (data.deploymentId === deploymentId) {
        setStatus(data.status);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [deploymentId]);

  const getLogColor = (level: string) => {
    switch (level) {
      case "error": return "text-red-400";
      case "success": return "text-[#00FF41]";
      case "warn": return "text-yellow-400";
      default: return "text-blue-200";
    }
  };

  const getTimelineSteps = () => {
    const steps = ["queued", "cloning", "detecting", "building", "deploying", "live"];
    const currentIndex = steps.indexOf(status === "failed" || status === "taken_down" ? "building" : status);
    
    return steps.map((step, idx) => ({
      step,
      active: idx === currentIndex,
      completed: idx < currentIndex || (status === "live"),
      failed: status === "failed" && idx === currentIndex
    }));
  };

  return (
    <div className="flex flex-col md:flex-row h-[500px]">
      {/* Visual Timeline (Left side on desktop) */}
      <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-white/5 bg-black/20 p-4 shrink-0">
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Launch Sequence</h4>
        <div className="space-y-4">
          {getTimelineSteps().map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="relative mt-1">
                <div className={`w-2.5 h-2.5 rounded-full z-10 relative ${
                  s.failed ? "bg-red-500" :
                  s.active ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : 
                  s.completed ? "bg-[#00FF41]" : "bg-white/10"
                }`} />
                {i < getTimelineSteps().length - 1 && (
                  <div className={`absolute top-2.5 left-1/2 -translate-x-1/2 w-0.5 h-6 -z-10 ${
                    s.completed ? "bg-[#00FF41]" : "bg-white/10"
                  }`} />
                )}
              </div>
              <span className={`text-xs font-mono uppercase ${
                s.failed ? "text-red-400 font-bold" :
                s.active ? "text-blue-300 font-bold" : 
                s.completed ? "text-white/80" : "text-muted-foreground"
              }`}>
                {s.step}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Log Output */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-[#050914]">
        <div className="font-mono text-xs space-y-1 pb-4">
          {logs.length === 0 ? (
            <div className="text-muted-foreground/50">Waiting for telemetry...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-4 hover:bg-white/[0.02] px-1 -mx-1 rounded">
                <span className="text-white/30 shrink-0 w-20 text-right select-none">
                  {format(new Date(log.timestamp), "HH:mm:ss")}
                </span>
                <span className={`whitespace-pre-wrap break-words ${getLogColor(log.level)}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}