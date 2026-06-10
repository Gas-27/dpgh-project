import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, Loader2, Users, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PushSubscription {
  id: string;
  endpoint: string;
  created_at: string;
  user_agent?: string;
}

interface SentNotification {
  id: string;
  title: string;
  body: string;
  sent_at: string;
  recipients_count: number;
}

export default function PushNotificationManager() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch push subscriptions - explicitly set high limit to get all subscribers
      const { data: subs, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10000);
      
      if (subsError) {
        console.error("[v0] Error fetching subscriptions:", subsError);
      }
      
      if (subs) {
        console.log("[v0] Fetched", subs.length, "PWA subscribers");
        setSubscriptions(subs);
      }

      // Fetch sent notifications
      const { data: notifs } = await supabase
        .from("sent_push_notifications")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(20);
      
      if (notifs) setSentNotifications(notifs);
    } catch (error) {
      console.error("[v0] Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Error", description: "Please enter title and message", variant: "destructive" });
      return;
    }

    if (subscriptions.length === 0) {
      toast({ title: "No subscribers", description: "There are no PWA users to send notifications to", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      // Call the Vercel API route to send push notifications
      const response = await fetch("/api/send-push-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || "/",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({ title: "Notifications sent!", description: `Sent to ${result.sent} subscribers` });
        setTitle("");
        setBody("");
        setUrl("/");
        fetchData();
      } else {
        throw new Error(result.error || "Failed to send notifications");
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({ title: "Error", description: "Failed to send notifications", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const deleteSubscription = async (id: string) => {
    try {
      await supabase.from("push_subscriptions").delete().eq("id", id);
      setSubscriptions(prev => prev.filter(s => s.id !== id));
      toast({ title: "Subscription removed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove subscription", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Send Notification Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Send Push Notification
          </CardTitle>
          <CardDescription>
            Send notifications to all {subscriptions.length} PWA users who have installed the app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. New Promo!"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label>Link (optional)</Label>
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="e.g. /packages"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Enter your notification message..."
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">{body.length}/200 characters</p>
          </div>
          <Button onClick={sendNotification} disabled={sending || subscriptions.length === 0} className="w-full sm:w-auto">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send to {subscriptions.length} subscribers
          </Button>
        </CardContent>
      </Card>

      {/* Subscribers Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            PWA Subscribers ({subscriptions.length})
          </CardTitle>
          <CardDescription>
            Users who have installed the PWA and allowed notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No subscribers yet. Users need to install the PWA and allow notifications.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {subscriptions.slice(0, 50).map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-mono text-xs">{sub.endpoint.slice(0, 60)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteSubscription(sub.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sent Notifications History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {sentNotifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No notifications sent yet</p>
          ) : (
            <div className="space-y-2">
              {sentNotifications.map(notif => (
                <div key={notif.id} className="p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{notif.title}</p>
                      <p className="text-sm text-muted-foreground">{notif.body}</p>
                    </div>
                    <Badge variant="outline">{notif.recipients_count} sent</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notif.sent_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
