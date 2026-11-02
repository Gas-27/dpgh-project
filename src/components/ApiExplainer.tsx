import { Info } from "lucide-react";

interface ApiExplainerProps {
  variant: "create" | "wallet";
}

export default function ApiExplainer({ variant }: ApiExplainerProps) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-2">
      <p className="flex items-center gap-2 font-semibold">
        <Info className="h-4 w-4 text-primary shrink-0" />
        {variant === "create" ? "What is an API key?" : "What is the API wallet?"}
      </p>
      <p className="text-muted-foreground leading-relaxed">
        An API lets people who own their own website or app connect it to ours, so their customers can buy data
        from your site and we deliver it automatically. If you do not own a website or app, you do not need an API key.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
        {variant === "wallet" && (
          <li>
            The API wallet is separate from your normal wallet. Money here can <span className="font-medium text-foreground">only be spent through your API</span>,
            from your own website, and cannot be used for purchases on this site.
          </li>
        )}
        <li>
          API prices can <span className="font-medium text-foreground">only be bought through your API key</span>. Your key uses the API price directly,
          so orders from your site are charged at the API price from your API wallet.
        </li>
        {variant === "create" && (
          <li>
            Deleting your key later also clears the money in your API wallet, so only generate one when you are ready to connect a site.
          </li>
        )}
      </ul>
    </div>
  );
}
