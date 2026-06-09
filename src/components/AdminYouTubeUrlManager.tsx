'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, AlertCircle, Check, Play } from 'lucide-react';

interface YouTubeSettings {
  agent_youtube_url: string | null;
  subagent_youtube_url: string | null;
}

export default function AdminYouTubeUrlManager() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<YouTubeSettings>({
    agent_youtube_url: null,
    subagent_youtube_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    fetchYouTubeSettings();
  }, []);

  const fetchYouTubeSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('afa_settings')
        .select('agent_youtube_url, subagent_youtube_url')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          agent_youtube_url: data.agent_youtube_url || null,
          subagent_youtube_url: data.subagent_youtube_url || null,
        });
      }
    } catch (error) {
      console.error('Error fetching YouTube settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load YouTube settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof YouTubeSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value || null,
    }));
    setChanged(true);
  };

  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
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

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('afa_settings')
        .update({
          agent_youtube_url: settings.agent_youtube_url,
          subagent_youtube_url: settings.subagent_youtube_url,
        })
        .eq('id', (await supabase.from('afa_settings').select('id').single()).data?.id);

      if (error) throw error;

      setChanged(false);
      toast({
        title: 'Success',
        description: 'YouTube URLs updated successfully',
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            YouTube Videos for Agents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agent YouTube URL */}
          <div className="space-y-2">
            <Label htmlFor="agent-youtube">Agent Dashboard YouTube URL</Label>
            <Input
              id="agent-youtube"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              value={settings.agent_youtube_url || ''}
              onChange={(e) => handleInputChange('agent_youtube_url', e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Paste the YouTube link that will be displayed in the Agent Dashboard
            </p>
            {settings.agent_youtube_url && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Preview:</p>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src={getEmbedUrl(settings.agent_youtube_url) || ''}
                    title="Agent YouTube Preview"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>

          {/* Subagent YouTube URL */}
          <div className="space-y-2 border-t pt-6">
            <Label htmlFor="subagent-youtube">Subagent Dashboard YouTube URL</Label>
            <Input
              id="subagent-youtube"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              value={settings.subagent_youtube_url || ''}
              onChange={(e) => handleInputChange('subagent_youtube_url', e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Paste the YouTube link that will be displayed in the Subagent Dashboard
            </p>
            {settings.subagent_youtube_url && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Preview:</p>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src={getEmbedUrl(settings.subagent_youtube_url) || ''}
                    title="Subagent YouTube Preview"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>

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
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save YouTube Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
