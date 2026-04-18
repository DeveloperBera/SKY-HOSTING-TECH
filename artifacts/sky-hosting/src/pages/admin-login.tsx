import { useState, type FormEvent } from "react";
import { useAdminAuth } from "@/context/admin-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Eye, EyeOff, Lock } from "lucide-react";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(key.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Authentication failed");
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">

        {/* Icon + title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm mb-2">
            <ShieldAlert className="w-8 h-8 text-[#00FF41]" />
          </div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">MISSION CONTROL</h1>
          <p className="text-muted-foreground text-sm">
            Restricted access. Enter your admin API key to continue.
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 space-y-6 shadow-2xl">
          {/* Hint */}
          <div className="rounded-lg bg-[#00FF41]/5 border border-[#00FF41]/20 px-4 py-3 text-xs text-[#00FF41]/80 font-mono">
            <span className="text-[#00FF41]">TIP</span> Default master key:{" "}
            <span className="select-all">sk_master_skyhosting</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Admin API Key
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type={show ? "text" : "password"}
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  placeholder="sk_live_..."
                  autoComplete="off"
                  className="pl-10 pr-10 bg-black/30 border-white/10 focus-visible:ring-[#00FF41] font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 font-mono animate-in fade-in duration-200">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !key.trim()}
              className="w-full font-mono text-sm bg-[#00FF41]/10 hover:bg-[#00FF41]/20 text-[#00FF41] border border-[#00FF41]/30 hover:border-[#00FF41]/60 transition-all duration-200 disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-[#00FF41]/40 border-t-[#00FF41] rounded-full animate-spin" />
                  AUTHENTICATING...
                </span>
              ) : (
                "AUTHENTICATE"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground/50 font-mono">
          Session expires when browser tab is closed
        </p>
      </div>
    </div>
  );
}
