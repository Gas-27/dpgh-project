import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function MarketplaceBanner({ onPost, onBrowse }: { onPost: () => void; onBrowse: () => void }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="font-semibold text-foreground">Marketplace</p>
          <p className="text-pretty text-sm text-muted-foreground">
            Post products for sale across the whole site and reach all agents, all customers, all subagents, all sub-subagents and visitors across the site as well. Get a global reach.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onPost}>Post Product</Button>
          <Button size="sm" variant="outline" onClick={onBrowse}>Browse Marketplace</Button>
        </div>
      </CardContent>
    </Card>
  );
}
