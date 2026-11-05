import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StoreInfo } from "@/components/FlyerShared";
import { SocialBoostFlyer } from "@/components/SocialBoostFlyer";
import { SubscriptionFlyer } from "@/components/SubscriptionFlyer";

export { SocialBoostFlyer, SubscriptionFlyer };

export default function FlyerTabs({ children, ...store }: StoreInfo & { children: ReactNode }) {
  return (
    <Tabs defaultValue="data" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="data">Data Flyer</TabsTrigger>
        <TabsTrigger value="social">Social Boost</TabsTrigger>
        <TabsTrigger value="subscription">Subscription</TabsTrigger>
      </TabsList>
      <TabsContent value="data" className="mt-0">{children}</TabsContent>
      <TabsContent value="social" className="mt-0"><SocialBoostFlyer {...store} /></TabsContent>
      <TabsContent value="subscription" className="mt-0"><SubscriptionFlyer {...store} /></TabsContent>
    </Tabs>
  );
}
