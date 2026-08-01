import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "agent" | "user" | "subagent" | "sub_subagent" | "sub_admin";

interface AuthContextValue {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isSubagent: boolean;
  isSubSubagent: boolean;
  hasPendingAgentStore: boolean;
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

  // Cache for pending agent store checks so we don't re-fetch every render
  const pendingStoreCache = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;

    const syncSession = async (currentUser: User | null, forceRoles = false) => {
      if (!mounted) return;

      setUser(currentUser);

      if (!currentUser) {
        setRoles([]);
        setHasPendingAgentStore(false);
        if (forceRoles) {
          rolesCache.current = {};
          pendingStoreCache.current = {};
        }
        setLoading(false);
        return;
      }

      // Fetch roles and pending agent store status in parallel so both are
      // ready at the same time — prevents hasPendingAgentStore being false
      // momentarily when PaymentDialog opens.
      const [nextRoles] = await Promise.all([
        fetchRoles(currentUser.id, forceRoles),
        (async () => {
          if (!forceRoles && pendingStoreCache.current[currentUser.id] !== undefined) return;
          const { data } = await supabase
            .from("agent_stores")
            .select("id, approved")
            .eq("user_id", currentUser.id)
            .maybeSingle();
          if (!mounted) return;
          const isPending = !!(data && !data.approved);
          pendingStoreCache.current[currentUser.id] = isPending;
          setHasPendingAgentStore(isPending);
        })(),
      ]);

      if (!mounted) return;

      setRoles(nextRoles);
      setLoading(false);
    };

    setLoading(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const shouldRefreshRoles = event === "SIGNED_IN" || event === "USER_UPDATED";
      if (!session?.user) {
        rolesCache.current = {};
      }
      void syncSession(session?.user ?? null, shouldRefreshRoles);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      // Force refresh roles on initial page load
      void syncSession(session?.user ?? null, true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
  const isSubagent = roles.includes("subagent");
  const isSubSubagent = roles.includes("sub_subagent");

  // hasPendingAgentStore is now fetched in syncSession alongside roles
  // so it is always ready before the component tree renders.
  const [hasPendingAgentStore, setHasPendingAgentStore] = useState(false);

  const getDashboardRoute = useCallback(() => {
    if (roles.includes("admin")) return "/admin-only";
    if (roles.includes("agent")) return "/agent";
    if (roles.includes("sub_subagent")) return "/sub-subagent-dashboard";
    if (roles.includes("subagent")) return "/subagent-dashboard";
    if (hasPendingAgentStore) return "/pending-approval";
    if (user) return "/user-dashboard";
    return "/";
  }, [roles, hasPendingAgentStore, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      loading,
      hasRole,
      isAdmin,
      isAgent,
      isSubagent,
      isSubSubagent,
      hasPendingAgentStore,
      signOut,
      getDashboardRoute,
    }),
    [user, roles, loading, hasRole, isAdmin, isAgent, isSubagent, isSubSubagent, hasPendingAgentStore, signOut, getDashboardRoute],
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
