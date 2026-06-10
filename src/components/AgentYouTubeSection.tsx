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
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  useEffect(() => {
    fetchYouTubeSettings();

    // Setup realtime listener
    let subscription: any;
    const setupListener = async () => {
      subscription = supabase
        .channel(`afa_settings_agent_youtube_${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'afa_settings' },
          () => {
            console.log('[v0] Detected YouTube settings update');
            fetchYouTubeSettings();
          }
        )
        .subscribe((status: string) => {
          console.log('[v0] Realtime subscription status:', status);
        });
    };

    setupListener();

    // Cleanup on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

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
        setCurrentVideoIndex(0);
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

  const handlePrevious = () => {
    setCurrentVideoIndex(prev => prev === 0 ? videos.length - 1 : prev - 1);
  };

  const handleNext = () => {
    setCurrentVideoIndex(prev => prev === videos.length - 1 ? 0 : prev + 1);
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

  const currentVideo = videos[currentVideoIndex];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Training Videos ({videos.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Video Title */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{currentVideo.title}</h3>
            {videos.length > 1 && (
              <span className="text-sm text-muted-foreground">
                {currentVideoIndex + 1} of {videos.length}
              </span>
            )}
          </div>

          {/* Video Player - Increased Size */}
          <div className="w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16 / 9', minHeight: '500px' }}>
            <iframe
              width="100%"
              height="100%"
              src={getEmbedUrl(currentVideo.url) || ''}
              title={currentVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ display: 'block' }}
            />
          </div>

          {/* Navigation Controls */}
          {videos.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="flex gap-2 flex-wrap justify-center">
                {videos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentVideoIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentVideoIndex ? 'bg-primary w-6' : 'bg-muted-foreground'
                    }`}
                    aria-label={`Go to video ${index + 1}`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
