import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "agent" | "user";

interface AuthContextValue {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isAgent: boolean;
  signOut: () => Promise<void>;
  getDashboardRoute: () => string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const rolesCache = useRef<Record<string, AppRole[]>>({});

  const fetchRoles = useCallback(async (userId: string, force = false) => {
    if (!force && rolesCache.current[userId]) return rolesCache.current[userId];

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to fetch roles:", error);
      return rolesCache.current[userId] ?? [];
    }

    const result = (data ?? []).map((roleRow) => roleRow.role as AppRole);
    rolesCache.current[userId] = result;
    return result;
  }, []);

  useEffect(() => {
    let mounted = true;
    let sessionCheckTimeout: NodeJS.Timeout;

    const syncSession = async (currentUser: User | null, forceRoles = false) => {
      if (!mounted) return;

      setUser(currentUser);

      if (!currentUser) {
        setRoles([]);
        if (forceRoles) rolesCache.current = {};
        setLoading(false);
        return;
      }

      const nextRoles = await fetchRoles(currentUser.id, forceRoles);
      if (!mounted) return;

      setRoles(nextRoles);
      setLoading(false);
    };

    setLoading(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const shouldRefreshRoles = event === "SIGNED_IN" || event === "USER_UPDATED";
      if (!session?.user && event === "SIGNED_OUT") {
        rolesCache.current = {};
      }
      void syncSession(session?.user ?? null, shouldRefreshRoles);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncSession(session?.user ?? null);
    });

    // Periodically refresh session to prevent auto-logout
    sessionCheckTimeout = setInterval(async () => {
      if (mounted) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !user) {
          void syncSession(session.user);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(sessionCheckTimeout);
    };
  }, [fetchRoles]);

  const signOut = useCallback(async () => {
    rolesCache.current = {};
    await supabase.auth.signOut();
    setUser(null);
    setRoles([]);
  }, []);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const isAdmin = roles.includes("admin");
  const isAgent = roles.includes("agent");

  const getDashboardRoute = useCallback(() => {
    if (roles.includes("admin")) return "/admin";
    if (roles.includes("agent")) return "/agent";
    return "/";
  }, [roles]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      loading,
      hasRole,
      isAdmin,
      isAgent,
      signOut,
      getDashboardRoute,
    }),
    [user, roles, loading, hasRole, isAdmin, isAgent, signOut, getDashboardRoute],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
