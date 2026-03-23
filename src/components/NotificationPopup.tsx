import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

const NotificationPopup = () => {
  const { user, roles } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!user || roles.length === 0) return;

    const fetchNotifications = async () => {
      const userRole = roles.includes("admin") ? "admin" : roles.includes("agent") ? "agent" : "user";

      const { data: dismissed } = await supabase
        .from("notification_dismissals")
        .select("notification_id")
        .eq("user_id", user.id);

      const dismissedIds = (dismissed ?? []).map((d: any) => d.notification_id);

      const { data: notifs } = await supabase
        .from("notifications")
        .select("*")
        .or(`target_role.eq.all,target_role.eq.${userRole}`)
        .order("created_at", { ascending: false });

      const unseen = (notifs ?? []).filter((n: any) => !dismissedIds.includes(n.id));
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

  return (
    <Dialog open={true} onOpenChange={() => dismiss()}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {notif.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {new Date(notif.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-foreground whitespace-pre-wrap">{notif.message}</p>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {notifications.length}
          </span>
          <Button variant="hero" size="sm" onClick={dismiss}>
            {currentIndex < notifications.length - 1 ? "Next" : "Got it"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPopup;
