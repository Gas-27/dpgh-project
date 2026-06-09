'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Play } from 'lucide-react';

export default function AgentYouTubeSection() {
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchYouTubeUrl();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('afa_settings_youtube_agent')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'afa_settings',
        },
        (payload) => {
          if (payload.new && 'agent_youtube_url' in payload.new) {
            setYoutubeUrl(payload.new.agent_youtube_url || null);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchYouTubeUrl = async () => {
    try {
      const { data } = await supabase
        .from('afa_settings')
        .select('agent_youtube_url')
        .single();

      if (data) {
        setYoutubeUrl(data.agent_youtube_url || null);
      }
    } catch (error) {
      console.error('Error fetching YouTube URL:', error);
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

  const embedUrl = youtubeUrl ? `https://www.youtube.com/embed/${extractYouTubeId(youtubeUrl)}` : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Training Video
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : embedUrl ? (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src={embedUrl}
              title="Agent Training Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground text-center">No training video available yet. Please check back soon.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
