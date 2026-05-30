import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

const getMeta = (text: string) => {
  const t = text.toLowerCase();

  if (t.includes("success") || t.includes("confirmed")) {
    return {
      icon: CheckCircle2,
      border: "border-green-500",
      glow: "shadow-green-500/20",
      tag: "Success",
    };
  }

  if (t.includes("error") || t.includes("failed")) {
    return {
      icon: XCircle,
      border: "border-red-500",
      glow: "shadow-red-500/20",
      tag: "Error",
    };
  }

  if (t.includes("warning") || t.includes("attention")) {
    return {
      icon: AlertTriangle,
      border: "border-yellow-500",
      glow: "shadow-yellow-500/20",
      tag: "Warning",
    };
  }

  return {
    icon: Info,
    border: "border-indigo-500",
    glow: "shadow-indigo-500/20",
    tag: "Info",
  };
};

const NotificationPopup = () => {
  const { user, roles } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!user || roles.length === 0) return;

    const fetchNotifications = async () => {
      const userRole = roles.includes("admin")
        ? "admin"
        : roles.includes("agent")
        ? "agent"
        : "user";

      const { data: dismissed } = await supabase
        .from("notification_dismissals")
        .select("notification_id")
        .eq("user_id", user.id);

      const dismissedIds = (dismissed ?? []).map(
        (d: any) => d.notification_id
      );

      const { data: notifs } = await supabase
        .from("notifications")
        .select("*")
        .or(`target_role.eq.all,target_role.eq.${userRole}`)
        .order("created_at", { ascending: false });

      const unseen = (notifs ?? []).filter(
        (n: any) => !dismissedIds.includes(n.id)
      );

      setNotifications(unseen);
      setCurrentIndex(0);
    };

    fetchNotifications();
  }, [user, roles]);

  const dismiss = async () => {
    if (!user || notifications.length === 0) return;

    const notif = notifications[currentIndex];

    await supabase.from("notification_dismissals").insert({
      notification_id: notif.id,
      user_id: user.id,
    });

    if (currentIndex < notifications.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setNotifications([]);
    }
  };

  if (notifications.length === 0) return null;

  const notif = notifications[currentIndex];
  const meta = getMeta(notif.message);
  const Icon = meta.icon;

  return (
    <Dialog open={true} onOpenChange={() => dismiss()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">

        {/* HEADER */}
        <div className="relative p-5 bg-gradient-to-r from-zinc-900 via-indigo-900 to-purple-900 text-white">

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-white/10 ${meta.glow}`}>
              <Bell className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-semibold">
                {notif.title}
              </h2>

              <p className="text-xs text-white/70">
                {new Date(notif.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4 bg-white dark:bg-zinc-900">

          {/* TAG */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded-full border ${meta.border} text-gray-700 dark:text-gray-300`}
            >
              {meta.tag}
            </span>
          </div>

          {/* MESSAGE CARD */}
          <div className={`border-l-4 ${meta.border} pl-3`}>
            <div className="flex gap-2 items-start">
              <Icon className="h-5 w-5 mt-0.5 text-indigo-500" />

              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {notif.message}
              </p>
            </div>
          </div>

          {/* COUNTER */}
          <div className="text-xs text-gray-400">
            Notification {currentIndex + 1} of {notifications.length}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-between items-center px-5 py-4 bg-gray-50 dark:bg-zinc-800 border-t">

          <Button
            onClick={dismiss}
            className={`bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2 rounded-xl text-sm hover:scale-[1.02] transition`}
          >
            {currentIndex < notifications.length - 1 ? "Next →" : "Got it ✓"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPopup;