import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  adminDeleteMarketingPost,
  adminFetchMarketingPosts,
  adminSaveMarketingPost,
  adminSetMarketingActive,
  type AdminMarketingPost,
} from "@/lib/marketingApi";

const QUERY_KEY = ["marketing-admin-posts"];

export default function AdminMarketing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["marketing-posts"] });
  };

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setCaption("");
    setImageUrl("");
  };

  const { data: posts = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: adminFetchMarketingPosts });

  const save = useMutation({
    mutationFn: () => adminSaveMarketingPost({ id: editingId, title: title.trim(), caption: caption.trim(), imageUrl: imageUrl.trim() }),
    onSuccess: () => {
      toast({ title: editingId ? "Post updated" : "Post published", description: "Agents will see it in their Marketing tab." });
      reset();
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => adminSetMarketingActive(id, active),
    onSuccess: refresh,
    onError: (error: Error) => toast({ title: "Could not update", description: error.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteMarketingPost(id),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not delete", description: error.message, variant: "destructive" }),
  });

  const startEdit = (post: AdminMarketingPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setCaption(post.caption);
    setImageUrl(post.image_url ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canSave = title.trim().length > 0 && caption.trim().length > 0 && !save.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Marketing posts</CardTitle>
          <CardDescription>
            Posts appear in every agent, subagent and sub-subagent Marketing tab with a preview and share buttons. Their own store link is added automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mk-title">Title</Label>
            <Input id="mk-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Weekend data deals" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mk-caption">Message to share</Label>
            <Textarea
              id="mk-caption"
              value={caption}
              maxLength={1000}
              rows={5}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Cheap MTN, Telecel and AirtelTigo data delivered in minutes. Tap the link below to order."
            />
            <p className="text-xs text-muted-foreground">Use {"{store}"} for the agent&apos;s store name. The store link is added after your message.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mk-image">Image link (optional)</Label>
            <Input id="mk-image" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." inputMode="url" />
            <p className="text-xs text-muted-foreground">Must start with https://. Shown in the story preview and as a download for agents.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={!canSave}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Publish post"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={reset}>
                Cancel edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && posts.length === 0 && <p className="text-sm text-muted-foreground">No marketing posts yet.</p>}
          {posts.map((post) => (
            <div key={post.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start">
              {post.image_url && <img src={post.image_url} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{post.title}</p>
                <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{post.caption}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={post.active} onCheckedChange={(active) => toggle.mutate({ id: post.id, active })} aria-label="Show to agents" />
                <Button size="icon" variant="outline" onClick={() => startEdit(post)} aria-label="Edit post">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => remove.mutate(post.id)} aria-label="Delete post">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
