import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListProjects, 
  useGetDashboardSummary, 
  useGetRecentActivity, 
  useCreateProject,
  useTriggerDeployment,
  getListProjectsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  Project
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Rocket, Activity, Globe, Cpu, Github, Clock, CheckCircle2, XCircle, ChevronRight, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: projects, isLoading: loadingProjects } = useListProjects({ query: { queryKey: getListProjectsQueryKey() } });
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  
  const [repoUrl, setRepoUrl] = useState("");
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  
  const createProject = useCreateProject();
  const triggerDeployment = useTriggerDeployment();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleDeploySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;
    setIsDeployDialogOpen(true);
  };

  const executeDeploy = async () => {
    try {
      let projectId = selectedProjectId;
      
      // If no existing project selected, create one
      if (projectId === "new") {
        if (!newProjectName) {
          toast({ title: "Error", description: "Project name required", variant: "destructive" });
          return;
        }
        const proj = await createProject.mutateAsync({ 
          data: { name: newProjectName, repoUrl } 
        });
        projectId = proj.id;
      }
      
      if (!projectId) return;

      const deploy = await triggerDeployment.mutateAsync({
        data: { projectId, repoUrl }
      });
      
      setIsDeployDialogOpen(false);
      setRepoUrl("");
      setNewProjectName("");
      setSelectedProjectId("");
      
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
      
      toast({
        title: "Deployment Initiated",
        description: "Your code is heading to space.",
      });
      
      // Navigate to project to see logs
      setLocation(`/projects/${projectId}`);
    } catch (err) {
      toast({
        title: "Deployment Failed",
        description: "Mission aborted.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-700">
      {/* Floating Deploy Bar */}
      <div className="max-w-2xl mx-auto -mt-4 relative z-20">
        <form onSubmit={handleDeploySubmit} className="relative">
          <div className="absolute inset-0 bg-[#00FF41]/10 blur-xl rounded-full" />
          <div className="relative flex items-center bg-background/80 backdrop-blur-xl border border-white/20 rounded-full p-2 shadow-2xl overflow-hidden">
            <Github className="w-5 h-5 text-muted-foreground ml-4 mr-2" />
            <Input 
              placeholder="Paste Git URL to deploy..." 
              className="border-0 bg-transparent focus-visible:ring-0 text-lg shadow-none flex-1 placeholder:text-muted-foreground/50 h-12"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <Button 
              type="submit" 
              className="rounded-full px-8 h-12 bg-white/10 hover:bg-[#00FF41]/20 text-white hover:text-[#00FF41] border border-white/10 hover:border-[#00FF41]/50 transition-all font-mono tracking-widest uppercase"
              disabled={!repoUrl}
            >
              <Rocket className="w-4 h-4 mr-2" /> Let's Go
            </Button>
          </div>
        </form>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
        {loadingSummary ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 glass-card rounded-xl" />)
        ) : summary ? (
          <>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
                    <p className="text-3xl font-bold font-mono">{summary.totalProjects}</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Live Deployments</p>
                    <p className="text-3xl font-bold font-mono text-[#00FF41] drop-shadow-[0_0_8px_rgba(0,255,65,0.5)]">
                      {summary.liveDeployments}
                    </p>
                  </div>
                  <div className="p-3 bg-[#00FF41]/10 rounded-lg">
                    <Globe className="w-5 h-5 text-[#00FF41]" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Builds Today</p>
                    <p className="text-3xl font-bold font-mono">{summary.buildsToday}</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Cpu className="w-5 h-5 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                    <p className="text-3xl font-bold font-mono">{summary.successRate}%</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Projects List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-mono tracking-tight">ACTIVE SATELLITES</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingProjects ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 glass-card rounded-xl" />)
            ) : projects?.length === 0 ? (
              <div className="col-span-2 p-12 text-center border border-dashed border-white/10 rounded-xl bg-white/5">
                <Rocket className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white">No projects yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Deploy a repository to launch your first satellite.</p>
              </div>
            ) : (
              projects?.map((project: Project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="glass-card border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group h-full">
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-lg text-white group-hover:text-[#00FF41] transition-colors">{project.name}</h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                          </p>
                        </div>
                        {project.status === "live" && (
                          <Badge variant="outline" className="neon-border-green neon-text-green bg-[#00FF41]/10 px-2 py-0.5 rounded-full font-mono tracking-widest text-[10px] uppercase">
                            LIVE
                          </Badge>
                        )}
                        {project.status === "building" && (
                          <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-mono tracking-widest text-[10px] uppercase animate-pulse">
                            BUILDING
                          </Badge>
                        )}
                        {project.status === "failed" && (
                          <Badge variant="outline" className="border-red-500/50 text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-mono tracking-widest text-[10px] uppercase">
                            FAILED
                          </Badge>
                        )}
                      </div>
                      
                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-white/5 hover:bg-white/10 text-xs font-mono">
                            {project.runtime}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {project.deploymentCount} deploys
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-mono tracking-tight">TELEMETRY</h2>
          <Card className="glass-card border-white/10 bg-white/5 h-[500px] flex flex-col">
            <ScrollArea className="flex-1 p-4">
              {loadingActivity ? (
                <div className="space-y-4">
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 bg-white/5" />)}
                </div>
              ) : activity?.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-12">
                  No telemetry data yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {activity?.map((item: any) => (
                    <div key={item.id} className="flex gap-3 text-sm pb-4 border-b border-white/5 last:border-0 last:pb-0">
                      <div className="mt-0.5">
                        {item.type === "deployed" && <CheckCircle2 className="w-4 h-4 text-[#00FF41]" />}
                        {item.type === "failed" && <XCircle className="w-4 h-4 text-red-400" />}
                        {item.type === "created" && <Rocket className="w-4 h-4 text-blue-400" />}
                        {item.type === "taken_down" && <Activity className="w-4 h-4 text-yellow-400" />}
                        {item.type === "deleted" && <XCircle className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-white">
                          <span className="font-semibold text-blue-200">{item.projectName}</span>
                          {" - "}
                          <span className="text-muted-foreground">{item.message}</span>
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      </div>

      {/* Deploy Dialog */}
      <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
        <DialogContent className="glass-card border-white/10 bg-[#0B0F19]/95 text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl">CONFIRM DEPLOYMENT</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Prepare to launch satellite from {repoUrl}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Target Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Select a project or create new" />
                </SelectTrigger>
                <SelectContent className="bg-background border-white/10">
                  <SelectItem value="new" className="text-blue-400 font-medium">✨ Create New Project</SelectItem>
                  {projects?.map((p: Project) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProjectId === "new" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Project Name</Label>
                <Input 
                  value={newProjectName} 
                  onChange={(e) => setNewProjectName(e.target.value)} 
                  placeholder="e.g. orbital-station-1"
                  className="bg-white/5 border-white/10 font-mono"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeployDialogOpen(false)} className="hover:bg-white/5 hover:text-white">
              Abort
            </Button>
            <Button 
              onClick={executeDeploy}
              disabled={createProject.isPending || triggerDeployment.isPending || (selectedProjectId === "new" && !newProjectName) || !selectedProjectId}
              className="bg-white/10 hover:bg-[#00FF41]/20 text-white hover:text-[#00FF41] border border-white/10 hover:border-[#00FF41]/50 font-mono tracking-widest uppercase"
            >
              {createProject.isPending || triggerDeployment.isPending ? "Initiating..." : "Launch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}