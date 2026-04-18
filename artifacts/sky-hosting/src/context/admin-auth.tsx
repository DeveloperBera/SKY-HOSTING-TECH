import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AdminAuthState {
  authenticated: boolean;
  keyName: string | null;
  apiKey: string | null;
}

interface AdminAuthContextValue extends AdminAuthState {
  login: (key: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const STORAGE_KEY = "sky_admin_auth";

function loadStoredAuth(): AdminAuthState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { authenticated: false, keyName: null, apiKey: null };
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>(loadStoredAuth);

  const login = useCallback(async (key: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/v1/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      if (res.ok) {
        const data = await res.json() as { name: string; scope: string };
        const next: AdminAuthState = { authenticated: true, keyName: data.name, apiKey: key };
        setState(next);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return { success: true };
      }

      const err = await res.json() as { error?: string };
      return { success: false, error: err.error || "Authentication failed" };
    } catch {
      return { success: false, error: "Could not reach the server" };
    }
  }, []);

  const logout = useCallback(() => {
    const next: AdminAuthState = { authenticated: false, keyName: null, apiKey: null };
    setState(next);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
}
