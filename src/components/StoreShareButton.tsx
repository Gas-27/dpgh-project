import { Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface StoreShareButtonProps {
  storeName: string;
  storeType: 'agent' | 'subagent';
  baseUrl?: string;
}

export default function StoreShareButton({
  storeName,
  storeType,
  baseUrl = 'https://datastores.shop',
}: StoreShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate the shareable preview URL
  const shareUrl = `${baseUrl}/api/preview/${storeType}/${encodeURIComponent(storeName)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Store preview link copied to clipboard',
      });

      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleShareVia = (platform: 'whatsapp' | 'facebook' | 'twitter') => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(
      `Check out ${storeName}! Get instant data bundles. Buy affordable MTN, AirtelTigo & Telecel data bundles. 📱`
    );

    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${text}%20${encodedUrl}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`;
        break;
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className="gap-2"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy Link
          </>
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleShareVia('whatsapp')}
        className="gap-2"
        title="Share on WhatsApp"
      >
        <Share2 className="w-4 h-4" />
        WhatsApp
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleShareVia('facebook')}
        className="gap-2"
        title="Share on Facebook"
      >
        <Share2 className="w-4 h-4" />
        Facebook
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleShareVia('twitter')}
        className="gap-2"
        title="Share on Twitter"
      >
        <Share2 className="w-4 h-4" />
        Twitter
      </Button>
    </div>
  );
}
