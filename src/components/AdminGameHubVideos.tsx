import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { deleteGameVideo, fetchGameVideos, uploadGameVideo, type GameVideo } from "@/lib/gameHubApi";
import { findHubGame, hubGames } from "@/lib/gameHubGames";

const QUERY_KEY = ["gamehub-videos"];

export default function AdminGameHubVideos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [gameId, setGameId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: videos = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchGameVideos });

  const upload = useMutation({
    mutationFn: () => uploadGameVideo(gameId, file as File),
    onSuccess: () => {
      toast({ title: "Video saved", description: `${findHubGame(gameId)?.name} now shows in the Game Hub carousel.` });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (video: GameVideo) => deleteGameVideo(video),
    onSuccess: () => {
      toast({ title: "Video removed" });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => toast({ title: "Could not remove video", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Game Hub gameplay videos</CardTitle>
          <CardDescription>
            Pick a game, then choose a gameplay video from your gallery. It plays in the Game Hub carousel, and its Play now button opens that game. Uploading again replaces the previous video (MP4, WebM or MOV, up to 50 MB).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gamehub-video-game">Game</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger id="gamehub-video-game"><SelectValue placeholder="Select a game" /></SelectTrigger>
              <SelectContent>
                {hubGames.map((game) => <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gamehub-video-file">Video from your gallery</Label>
            <input
              ref={fileInput}
              id="gamehub-video-file"
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {file ? <p className="text-xs text-muted-foreground">{file.name} - {(file.size / (1024 * 1024)).toFixed(1)} MB</p> : null}
          </div>
          <Button type="button" disabled={!gameId || !file || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="mr-2 h-4 w-4" aria-hidden="true" />}
            {upload.isPending ? "Uploading..." : "Upload video"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Videos on display ({videos.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
          {!isLoading && videos.length === 0 ? <p className="text-sm text-muted-foreground">No videos yet. The carousel shows the default slides until you add one.</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((video) => (
              <div key={video.game_id} className="space-y-2 rounded-lg border p-3">
                <video src={video.video_url} controls muted playsInline preload="metadata" className="aspect-video w-full rounded-md bg-black" />
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{findHubGame(video.game_id)?.name ?? video.game_id}</p>
                  <Button type="button" variant="outline" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(video)} aria-label={`Remove video for ${findHubGame(video.game_id)?.name ?? video.game_id}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
