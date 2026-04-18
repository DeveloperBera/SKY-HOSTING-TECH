import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import ProjectDetail from "@/pages/project-detail";
import ApiDocs from "@/pages/api-docs";
import Admin from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import NotFound from "@/pages/not-found";
import { AdminAuthProvider, useAdminAuth } from "@/context/admin-auth";

const queryClient = new QueryClient();

function AdminRoute() {
  const { authenticated } = useAdminAuth();
  return authenticated ? <Admin /> : <AdminLogin />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/docs" component={ApiDocs} />
        <Route path="/admin" component={AdminRoute} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AdminAuthProvider>
            <Router />
          </AdminAuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
