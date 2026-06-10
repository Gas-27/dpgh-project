'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Video {
  id: string;
  title: string;
  url: string;
  type: 'agent' | 'subagent';
}

export default function AgentYouTubeSection() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchYouTubeSettings();
    setupRealtimeListener();
  }, []);

  const setupRealtimeListener = () => {
    const subscription = supabase
      .channel('afa_settings_agent_youtube')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'afa_settings' },
        () => fetchYouTubeSettings()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const fetchYouTubeSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('afa_settings')
        .select(`
          agent_video_1_title, agent_video_1_url,
          agent_video_2_title, agent_video_2_url,
          agent_video_3_title, agent_video_3_url
        `)
        .single();

      if (data) {
        const fetchedVideos: Video[] = [];
        
        if (data.agent_video_1_url) {
          fetchedVideos.push({
            id: '1',
            title: data.agent_video_1_title || 'Video 1',
            url: data.agent_video_1_url,
            type: 'agent',
          });
        }
        
        if (data.agent_video_2_url) {
          fetchedVideos.push({
            id: '2',
            title: data.agent_video_2_title || 'Video 2',
            url: data.agent_video_2_url,
            type: 'agent',
          });
        }
        
        if (data.agent_video_3_url) {
          fetchedVideos.push({
            id: '3',
            title: data.agent_video_3_title || 'Video 3',
            url: data.agent_video_3_url,
            type: 'agent',
          });
        }
        
        setVideos(fetchedVideos);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
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

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('agent-videos-scroll');
    if (container) {
      const scrollAmount = 400;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (loading) {
    return null;
  }

  if (!videos || videos.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Training Videos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground text-center">No training videos available yet. Please check back soon.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Training Videos ({videos.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Horizontal Scroll Container */}
          <div className="relative">
            {videos.length > 1 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full p-1"
                  onClick={() => scroll('left')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full p-1"
                  onClick={() => scroll('right')}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}

            <div
              id="agent-videos-scroll"
              className="flex gap-4 overflow-x-auto scroll-smooth pb-4 px-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {videos.map(video => (
                <div key={video.id} className="flex-shrink-0 w-96">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold truncate">{video.title || 'Untitled Video'}</p>
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <iframe
                        width="100%"
                        height="100%"
                        src={getEmbedUrl(video.url) || ''}
                        title={video.title || 'Training Video'}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Video Indicators */}
          {videos.length > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              {videos.map((_, index) => (
                <div
                  key={index}
                  className="h-2 rounded-full bg-muted"
                  style={{ width: `${Math.min(100, 8 * videos.length)}px` }}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
