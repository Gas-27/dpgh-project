import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "agent" | "user" | "subagent" | "sub_subagent";

interface AuthContextValue {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isSubagent: boolean;
  isSubSubagent: boolean;
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
    if (!force && rolesCache.current[userId]) {
      console.log("[v0] fetchRoles - returning cached roles for", userId, rolesCache.current[userId]);
      return rolesCache.current[userId];
    }

    console.log("[v0] fetchRoles - querying database for", userId, "force:", force);
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    console.log("[v0] fetchRoles - query result:", { data, error });

    if (error) {
      console.error("[v0] Failed to fetch roles:", error);
      return rolesCache.current[userId] ?? [];
    }

    const result = (data ?? []).map((roleRow) => roleRow.role as AppRole);
    console.log("[v0] fetchRoles - found roles:", result);
    rolesCache.current[userId] = result;
    return result;
  }, []);

  useEffect(() => {
    let mounted = true;

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
      if (!session?.user) {
        rolesCache.current = {};
      }
      void syncSession(session?.user ?? null, shouldRefreshRoles);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncSession(session?.user ?? null);
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

  // Track whether user has a pending (unapproved) agent store
  const [hasPendingAgentStore, setHasPendingAgentStore] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasPendingAgentStore(false);
      return;
    }
    // Check if user has an unapproved agent store
    supabase
      .from("agent_stores")
      .select("id, approved")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && !data.approved) {
          setHasPendingAgentStore(true);
        } else {
          setHasPendingAgentStore(false);
        }
      });
  }, [user]);

  const getDashboardRoute = useCallback(() => {
    if (roles.includes("admin")) return "/admin";
    if (roles.includes("agent")) return "/agent";
    if (roles.includes("sub_subagent")) return "/sub-subagent-dashboard";
    if (roles.includes("subagent")) return "/subagent-dashboard";
    if (hasPendingAgentStore) return "/pending-approval";
    return "/";
  }, [roles, hasPendingAgentStore]);

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
      signOut,
      getDashboardRoute,
    }),
    [user, roles, loading, hasRole, isAdmin, isAgent, isSubagent, isSubSubagent, signOut, getDashboardRoute],
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
