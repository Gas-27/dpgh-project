import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminProfitCosts from "@/components/AdminProfitCosts";
import AdminProfitOverview from "@/components/AdminProfitOverview";

export default function AdminProfit() {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="costs">Cost prices</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-4">
        <AdminProfitOverview />
      </TabsContent>
      <TabsContent value="costs" className="space-y-4">
        <AdminProfitCosts />
      </TabsContent>
    </Tabs>
  );
}
