'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { AFAMedia } from '@/services/afa-media-service';

interface AFAVideoPlayerProps {
  media: AFAMedia;
  showTitle?: boolean;
  className?: string;
}

export default function AFAVideoPlayer({
  media,
  showTitle = true,
  className = '',
}: AFAVideoPlayerProps) {
  const [isValidUrl, setIsValidUrl] = useState(true);

  useEffect(() => {
    // Validate that URL is a proper video URL
    if (!media.url) {
      setIsValidUrl(false);
      return;
    }

    const validVideoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    const isVideoFile = validVideoExtensions.some(ext => media.url.toLowerCase().includes(ext));
    const isYoutubeUrl = media.url.includes('youtube.com') || media.url.includes('youtu.be');
    const isVimeoUrl = media.url.includes('vimeo.com');

    setIsValidUrl(isVideoFile || isYoutubeUrl || isVimeoUrl);
  }, [media.url]);

  if (!isValidUrl) {
    return (
      <Card className={`border-yellow-500/30 bg-yellow-50/5 ${className}`}>
        <CardContent className="pt-6">
          <div className="flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm text-yellow-800">Invalid Video URL</p>
              <p className="text-sm text-yellow-700">The video URL is not valid. Please check the URL format.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Convert URL to embed format if needed
  const getEmbedUrl = (url: string): string => {
    // YouTube
    if (url.includes('youtube.com')) {
      const videoId = url.split('v=')[1];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    if (url.includes('youtu.be')) {
      const videoId = url.split('/').pop();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    // Vimeo
    if (url.includes('vimeo.com')) {
      const videoId = url.split('/').pop();
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
    }
    return url;
  };

  const isEmbeddable = media.url.includes('youtube.com') || media.url.includes('youtu.be') || media.url.includes('vimeo.com');

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="text-lg">{media.title}</CardTitle>
          {media.description && <CardDescription>{media.description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={showTitle ? '' : 'p-6'}>
        <div className="w-full bg-black rounded-lg overflow-hidden">
          {isEmbeddable ? (
            <iframe
              width="100%"
              height="400"
              src={getEmbedUrl(media.url)}
              title={media.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full"
            />
          ) : (
            <video
              width="100%"
              height="400"
              controls
              className="w-full bg-black"
              controlsList="nodownload"
            >
              <source src={media.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
