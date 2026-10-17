'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Play, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import {
  fetchTrainingVideos,
  getYouTubeEmbedUrl,
  type TrainingVideo,
  type TrainingVideoRole,
} from '@/lib/trainingVideos';

export default function TrainingVideosSection({ role }: { role: TrainingVideoRole }) {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchTrainingVideos(role);
      setVideos(next);
      setCurrentVideoIndex(0);
    } catch (error) {
      console.error('Error fetching training videos:', error);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`afa_settings_${role}_training_videos`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'afa_settings' },
        () => { load(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, load]);

  if (loading) return null;

  if (videos.length === 0) {
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
  const embedUrl = getYouTubeEmbedUrl(currentVideo.url);

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Training Videos ({videos.length})
          </CardTitle>
          <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{currentVideo.title}</h3>
              {videos.length > 1 && (
                <span className="text-sm text-muted-foreground">
                  {currentVideoIndex + 1} of {videos.length}
                </span>
              )}
            </div>

            <div
              className="w-full bg-black rounded-lg overflow-hidden"
              style={{ aspectRatio: '16 / 9', minHeight: 'clamp(250px, 50vw, 500px)' }}
            >
              {embedUrl ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={embedUrl}
                  title={currentVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ display: 'block' }}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                  This video link is not a valid YouTube URL.
                </div>
              )}
            </div>

            {videos.length > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentVideoIndex((i) => (i === 0 ? videos.length - 1 : i - 1))}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                <div className="flex gap-2 flex-wrap justify-center">
                  {videos.map((video, index) => (
                    <button
                      key={video.id}
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
                  onClick={() => setCurrentVideoIndex((i) => (i === videos.length - 1 ? 0 : i + 1))}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
