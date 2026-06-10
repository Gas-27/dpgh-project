'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, AlertCircle, Check, Play, Plus, Trash2, Eye } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  url: string;
  type: 'agent' | 'subagent';
}

interface YouTubeSettings {
  agent_videos: Video[];
  subagent_videos: Video[];
}

export default function AdminYouTubeUrlManager() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<YouTubeSettings>({
    agent_videos: [],
    subagent_videos: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    fetchYouTubeSettings();
  }, []);

  const fetchYouTubeSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('afa_settings')
        .select('agent_videos, subagent_videos')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Fetch error:', error);
      }

      if (data) {
        setSettings({
          agent_videos: data.agent_videos || [],
          subagent_videos: data.subagent_videos || [],
        });
      }
    } catch (error) {
      console.error('Error fetching YouTube settings:', error);
    } finally {
      setLoading(false);
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
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const getEmbedUrl = (url: string | null): string | null => {
    if (!url) return null;
    const videoId = extractYouTubeId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const addVideo = (type: 'agent' | 'subagent') => {
    const newVideo: Video = {
      id: Date.now().toString(),
      title: '',
      url: '',
      type,
    };
    setSettings(prev => ({
      ...prev,
      [type === 'agent' ? 'agent_videos' : 'subagent_videos']: [
        ...prev[type === 'agent' ? 'agent_videos' : 'subagent_videos'],
        newVideo,
      ],
    }));
    setChanged(true);
  };

  const updateVideo = (id: string, type: 'agent' | 'subagent', field: string, value: string) => {
    const key = type === 'agent' ? 'agent_videos' : 'subagent_videos';
    setSettings(prev => ({
      ...prev,
      [key]: prev[key].map(video =>
        video.id === id ? { ...video, [field]: value } : video
      ),
    }));
    setChanged(true);
  };

  const deleteVideo = (id: string, type: 'agent' | 'subagent') => {
    const key = type === 'agent' ? 'agent_videos' : 'subagent_videos';
    setSettings(prev => ({
      ...prev,
      [key]: prev[key].filter(video => video.id !== id),
    }));
    setChanged(true);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // First get the existing afa_settings record
      const { data: existingData } = await supabase
        .from('afa_settings')
        .select('id')
        .single();

      if (existingData) {
        const { error } = await supabase
          .from('afa_settings')
          .update({
            agent_videos: settings.agent_videos,
            subagent_videos: settings.subagent_videos,
          })
          .eq('id', existingData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('afa_settings')
          .insert({
            agent_videos: settings.agent_videos,
            subagent_videos: settings.subagent_videos,
          });

        if (error) throw error;
      }

      setChanged(false);
      toast({
        title: 'Success',
        description: 'YouTube videos updated successfully',
      });
    } catch (error) {
      console.error('Error saving YouTube settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save YouTube settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const renderVideoList = (videos: Video[], type: 'agent' | 'subagent') => (
    <div className="space-y-4">
      {videos.map(video => (
        <div key={video.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex-1 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Video Title</Label>
                <Input
                  placeholder="e.g., Getting Started, How to Register, etc."
                  value={video.title}
                  onChange={(e) => updateVideo(video.id, type, 'title', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">YouTube URL</Label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={video.url}
                  onChange={(e) => updateVideo(video.id, type, 'url', e.target.value)}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 ml-2">
              {video.url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewId(previewId === video.id ? null : video.id)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteVideo(video.id, type)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {previewId === video.id && video.url && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Preview:</p>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  width="100%"
                  height="100%"
                  src={getEmbedUrl(video.url) || ''}
                  title={video.title || 'YouTube Preview'}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      ))}
      <Button
        onClick={() => addVideo(type)}
        variant="outline"
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Video
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Agent Videos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Agent Training Videos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderVideoList(settings.agent_videos, 'agent')}
        </CardContent>
      </Card>

      {/* Subagent Videos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Subagent Training Videos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderVideoList(settings.subagent_videos, 'subagent')}
        </CardContent>
      </Card>

      {changed && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Click Save to apply them.
          </AlertDescription>
        </Alert>
      )}

      <Button
        onClick={saveSettings}
        disabled={!changed || saving}
        className="w-full"
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Save All Videos
          </>
        )}
      </Button>
    </div>
  );
}
