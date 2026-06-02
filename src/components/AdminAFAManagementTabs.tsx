import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminAFAPriceManager from './AdminAFAPriceManager';
import AFARegistrationManagement from './AFARegistrationManagement';
import AFAAnalyticsMonitoring from './AFAAnalyticsMonitoring';
import { DollarSign, Users, BarChart3 } from 'lucide-react';

export default function AdminAFAManagementTabs() {
  return (
    <Tabs defaultValue="pricing" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="pricing" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Pricing
        </TabsTrigger>
        <TabsTrigger value="registrations" className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Registrations
        </TabsTrigger>
        <TabsTrigger value="analytics" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Analytics
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pricing" className="space-y-6">
        <AdminAFAPriceManager />
      </TabsContent>

      <TabsContent value="registrations" className="space-y-6">
        <AFARegistrationManagement />
      </TabsContent>

      <TabsContent value="analytics" className="space-y-6">
        <AFAAnalyticsMonitoring />
      </TabsContent>
    </Tabs>
  );
}
