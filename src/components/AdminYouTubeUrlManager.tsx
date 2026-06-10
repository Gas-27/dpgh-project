'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Play, Trash2 } from 'lucide-react';

interface VideoSettings {
  title: string;
  url: string;
}

export default function AdminYouTubeUrlManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Agent videos
  const [agentVideos, setAgentVideos] = useState<VideoSettings[]>([
    { title: '', url: '' },
    { title: '', url: '' },
    { title: '', url: '' },
  ]);

  // Subagent videos
  const [subagentVideos, setSubagentVideos] = useState<VideoSettings[]>([
    { title: '', url: '' },
    { title: '', url: '' },
    { title: '', url: '' },
  ]);

  const [previewingAgent, setPreviewingAgent] = useState<number | null>(null);
  const [previewingSubagent, setPreviewingSubagent] = useState<number | null>(null);

  useEffect(() => {
    fetchYouTubeSettings();
  }, []);

  const fetchYouTubeSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('afa_settings')
        .select(`
          agent_video_1_title, agent_video_1_url,
          agent_video_2_title, agent_video_2_url,
          agent_video_3_title, agent_video_3_url,
          subagent_video_1_title, subagent_video_1_url,
          subagent_video_2_title, subagent_video_2_url,
          subagent_video_3_title, subagent_video_3_url
        `)
        .single();

      if (data) {
        setAgentVideos([
          { title: data.agent_video_1_title || '', url: data.agent_video_1_url || '' },
          { title: data.agent_video_2_title || '', url: data.agent_video_2_url || '' },
          { title: data.agent_video_3_title || '', url: data.agent_video_3_url || '' },
        ]);

        setSubagentVideos([
          { title: data.subagent_video_1_title || '', url: data.subagent_video_1_url || '' },
          { title: data.subagent_video_2_title || '', url: data.subagent_video_2_url || '' },
          { title: data.subagent_video_3_title || '', url: data.subagent_video_3_url || '' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching YouTube settings:', error);
      toast({ title: 'Error', description: 'Failed to load video settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, string | null> = {
        agent_video_1_title: agentVideos[0]?.title || null,
        agent_video_1_url: agentVideos[0]?.url || null,
        agent_video_2_title: agentVideos[1]?.title || null,
        agent_video_2_url: agentVideos[1]?.url || null,
        agent_video_3_title: agentVideos[2]?.title || null,
        agent_video_3_url: agentVideos[2]?.url || null,
        subagent_video_1_title: subagentVideos[0]?.title || null,
        subagent_video_1_url: subagentVideos[0]?.url || null,
        subagent_video_2_title: subagentVideos[1]?.title || null,
        subagent_video_2_url: subagentVideos[1]?.url || null,
        subagent_video_3_title: subagentVideos[2]?.title || null,
        subagent_video_3_url: subagentVideos[2]?.url || null,
      };

      const { error } = await supabase
        .from('afa_settings')
        .update(updateData)
        .eq('id', (await supabase.from('afa_settings').select('id').single()).data?.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Training videos updated successfully' });
    } catch (error) {
      console.error('Error saving YouTube settings:', error);
      toast({ title: 'Error', description: 'Failed to save video settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const getEmbedUrl = (url: string): string | null => {
    const videoId = extractYouTubeId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const VideoInput = ({
    videos,
    setVideos,
    title,
    isAgent,
  }: {
    videos: VideoSettings[];
    setVideos: (v: VideoSettings[]) => void;
    title: string;
    isAgent: boolean;
  }) => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {videos.map((video, index) => (
          <div key={index} className="space-y-4 border-b pb-4 last:border-0">
            <p className="text-sm font-semibold text-muted-foreground">Video {index + 1}</p>

            <div className="space-y-2">
              <Label className="text-sm">Title</Label>
              <Input
                placeholder={`Enter video title (optional)`}
                value={video.title}
                onChange={(e) => {
                  const updated = [...videos];
                  updated[index].title = e.target.value;
                  setVideos(updated);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">YouTube URL</Label>
              <Input
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                value={video.url}
                onChange={(e) => {
                  const updated = [...videos];
                  updated[index].url = e.target.value;
                  setVideos(updated);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Supported: Full URL, Short URL, Embed URL, or Video ID
              </p>
            </div>

            {/* Live Preview */}
            {video.url && getEmbedUrl(video.url) && (
              <div className="space-y-2">
                <Label className="text-sm">Preview</Label>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src={getEmbedUrl(video.url) || ''}
                    title={`Preview - ${video.title || 'Video'}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VideoInput videos={agentVideos} setVideos={setAgentVideos} title="Agent Training Videos" isAgent={true} />
        <VideoInput videos={subagentVideos} setVideos={setSubagentVideos} title="Subagent Training Videos" isAgent={false} />
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        size="lg"
        className="w-full"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save All Videos
          </>
        )}
      </Button>
    </div>
  );
}
