import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface PaginatedTableFooterProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  totalLoaded: number;
}

export function PaginatedTableFooter({
  hasMore,
  isLoading,
  onLoadMore,
  totalLoaded,
}: PaginatedTableFooterProps) {
  if (!hasMore && totalLoaded === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-4 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {totalLoaded} items
      </p>
      {hasMore && (
        <Button
          onClick={onLoadMore}
          disabled={isLoading}
          variant="outline"
          className="gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Loading...' : 'Load More'}
        </Button>
      )}
      {!hasMore && totalLoaded > 0 && (
        <p className="text-sm text-muted-foreground italic">
          All items loaded
        </p>
      )}
    </div>
  );
}
