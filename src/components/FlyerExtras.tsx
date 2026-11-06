import { isValidElement, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StoreInfo } from "@/components/FlyerShared";
import type { FlyerPackages } from "@/components/DynamicFlyer";
import { GreenDataFlyer } from "@/components/GreenDataFlyer";
import { AfaFlyer } from "@/components/AfaFlyer";
import { SocialBoostFlyer } from "@/components/SocialBoostFlyer";
import { SubscriptionFlyer } from "@/components/SubscriptionFlyer";

export { SocialBoostFlyer, SubscriptionFlyer, GreenDataFlyer };

type FlyerTabsProps = StoreInfo & { children: ReactNode; afaPrice?: number | null };

export default function FlyerTabs({ children, afaPrice, ...store }: FlyerTabsProps) {
  // The default flyer already receives the live package prices; the Data Flyer tab reuses them.
  const packages = isValidElement(children) ? (children.props as { packages?: FlyerPackages }).packages : undefined;

  return (
    <Tabs defaultValue="flyer" className="space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5">
        <TabsTrigger value="flyer">Flyer</TabsTrigger>
        <TabsTrigger value="data">Data Flyer</TabsTrigger>
        <TabsTrigger value="afa">AFA Flyer</TabsTrigger>
        <TabsTrigger value="social">Social Boost</TabsTrigger>
        <TabsTrigger value="subscription">Subscription</TabsTrigger>
      </TabsList>
      <TabsContent value="flyer" className="mt-0">{children}</TabsContent>
      <TabsContent value="data" className="mt-0"><GreenDataFlyer {...store} packages={packages} afaPrice={afaPrice} /></TabsContent>
      <TabsContent value="afa" className="mt-0"><AfaFlyer {...store} afaPrice={afaPrice} /></TabsContent>
      <TabsContent value="social" className="mt-0"><SocialBoostFlyer {...store} /></TabsContent>
      <TabsContent value="subscription" className="mt-0"><SubscriptionFlyer {...store} /></TabsContent>
    </Tabs>
  );
}
