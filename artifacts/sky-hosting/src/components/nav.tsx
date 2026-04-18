import { Link, useLocation } from "wouter";
import { LayoutDashboard, Settings, BookOpen, Rocket, LogOut } from "lucide-react";
import { useAdminAuth } from "@/context/admin-auth";

export function Nav() {
  const [location] = useLocation();
  const { authenticated, keyName, logout } = useAdminAuth();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/docs", label: "API Docs", icon: BookOpen },
    { href: "/admin", label: "Admin", icon: Settings },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/50 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Rocket className="w-6 h-6 text-primary group-hover:text-[#00FF41] transition-colors duration-300" />
          <span className="font-mono font-bold tracking-widest text-lg">SKY_HOSTING</span>
        </Link>
        <div className="flex items-center gap-6">
          {links.map((link) => {
            const Icon = link.icon;
            const active = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 text-sm font-medium transition-all duration-300 ${
                  active ? "text-[#00FF41] drop-shadow-[0_0_8px_rgba(0,255,65,0.5)]" : "text-muted-foreground hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline-block">{link.label}</span>
              </Link>
            );
          })}

          {authenticated && (
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <span className="text-xs font-mono text-[#00FF41]/70 hidden md:block">
                {keyName}
              </span>
              <button
                onClick={logout}
                title="Sign out of admin"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-400 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline-block text-xs font-mono">LOGOUT</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
