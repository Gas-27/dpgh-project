import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { adminDeleteAnnouncement, adminFetchAnnouncements, adminPostAnnouncement, adminSetAnnouncementActive } from "@/lib/gameHubApi";

const QUERY_KEY = ["gamehub-admin-announcements"];

export default function AdminGameAnnouncements() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["gamehub-announcements"] });
  };

  const { data: items = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: adminFetchAnnouncements });

  const post = useMutation({
    mutationFn: () => adminPostAnnouncement(title.trim(), body.trim()),
    onSuccess: () => {
      toast({ title: "Notification posted", description: "Players will see it when they open Game Hub." });
      setTitle("");
      setBody("");
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not post", description: error.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => adminSetAnnouncementActive(id, active),
    onSuccess: refresh,
    onError: (error: Error) => toast({ title: "Could not update", description: error.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteAnnouncement(id),
    onSuccess: () => {
      toast({ title: "Notification deleted" });
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not delete", description: error.message, variant: "destructive" }),
  });

  const canPost = title.trim().length > 0 && body.trim().length > 0 && !post.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Game Hub notifications</CardTitle>
          <CardDescription>Active notifications pop up for players each time they open Game Hub (once per notification per device).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gh-ann-title">Title</Label>
            <Input id="gh-ann-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="New game just dropped" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gh-ann-body">Message</Label>
            <Textarea id="gh-ann-body" value={body} maxLength={1000} rows={4} onChange={(event) => setBody(event.target.value)} placeholder="Tell players what is new..." />
            <p className="text-xs text-muted-foreground">{body.length}/1000</p>
          </div>
          <Button onClick={() => post.mutate()} disabled={!canPost}>
            {post.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Post notification
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Posted notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
          {!isLoading && items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing posted yet.</p> : null}
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.body}</p>
                <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={item.active} onCheckedChange={(active) => toggle.mutate({ id: item.id, active })} aria-label={`Show ${item.title} to players`} />
                  <span className="text-xs text-muted-foreground">{item.active ? "Live" : "Hidden"}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)} aria-label={`Delete ${item.title}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
