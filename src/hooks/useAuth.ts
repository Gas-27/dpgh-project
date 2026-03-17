import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "agent" | "user";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const rolesCache = useRef<Record<string, AppRole[]>>({});

  const fetchRoles = useCallback(async (userId: string) => {
    if (rolesCache.current[userId]) return rolesCache.current[userId];
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const result = (data ?? []).map((r: any) => r.role as AppRole);
    rolesCache.current[userId] = result;
    return result;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const userRoles = await fetchRoles(currentUser.id);
        if (mounted) setRoles(userRoles);
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          // Clear cache on sign in to get fresh roles
          if (event === "SIGNED_IN") {
            delete rolesCache.current[currentUser.id];
          }
          const userRoles = await fetchRoles(currentUser.id);
          if (mounted) setRoles(userRoles);
        } else {
          setRoles([]);
          rolesCache.current = {};
        }
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isAgent = hasRole("agent");

  const signOut = async () => {
    rolesCache.current = {};
    await supabase.auth.signOut();
    setUser(null);
    setRoles([]);
  };

  const getDashboardRoute = (): string => {
    if (roles.includes("admin")) return "/admin";
    if (roles.includes("agent")) return "/agent";
    return "/";
  };

  return { user, roles, loading, hasRole, isAdmin, isAgent, signOut, getDashboardRoute };
}
