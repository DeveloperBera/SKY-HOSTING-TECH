import { useGetAdminStats, useGenerateApiKey, getGetAdminStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Activity, Users, Zap, Key } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Admin() {
  const { data: stats, isLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write" | "admin">("read");
  const generateKey = useGenerateApiKey();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    generateKey.mutate({ data: { name, scope } }, {
      onSuccess: (data) => {
        toast({
          title: "API Key Generated",
          description: "Key generated successfully. Make sure to copy it now.",
        });
        setName("");
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        // In a real app we'd display the raw key returned
        alert(`New API Key (copy this): ${data.key}`);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to generate API key.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold font-mono tracking-tight">MISSION CONTROL</h1>
        <p className="text-muted-foreground mt-2">System administration and telemetry.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 glass-card rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Deployments</CardTitle>
              <Activity className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats.totalDeployments}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.activeDeployments} active</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Sockets</CardTitle>
              <Zap className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats.activeWebSocketConnections}</div>
              <p className="text-xs text-muted-foreground mt-1">Live terminal connections</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Server Load</CardTitle>
              <Server className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats.serverLoad}%</div>
              <p className="text-xs text-muted-foreground mt-1">System capacity</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
              <Users className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats.totalProjects}</div>
              <p className="text-xs text-muted-foreground mt-1">Deployed services</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass-card border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Key Management
            </CardTitle>
            <CardDescription>Generate new service keys for external integrations.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerateKey} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Key Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. CI/CD Pipeline" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/50 border-white/10 focus-visible:ring-[#00FF41]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                  <SelectTrigger className="bg-background/50 border-white/10 focus:ring-[#00FF41]">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-white/10 text-foreground">
                    <SelectItem value="read">Read Only</SelectItem>
                    <SelectItem value="write">Read & Write</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-white/10 hover:bg-[#00FF41]/20 text-white hover:text-[#00FF41] border border-white/10 hover:border-[#00FF41]/50 transition-all"
                disabled={generateKey.isPending || !name}
              >
                {generateKey.isPending ? "Generating..." : "Generate Key"}
              </Button>
            </form>

            {stats?.masterApiKey && (
              <div className="mt-8 p-4 rounded-md bg-black/40 border border-white/5">
                <div className="text-sm text-muted-foreground mb-2">Master API Key (Masked)</div>
                <code className="font-mono text-xs text-blue-300 break-all">
                  {stats.masterApiKey.substring(0, 8)}...{stats.masterApiKey.substring(stats.masterApiKey.length - 8)}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}