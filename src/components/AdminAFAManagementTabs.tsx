import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminAFASettings from './AdminAFASettings';
import AdminAFAPriceManager from './AdminAFAPriceManager';
import AFARegistrationManagement from './AFARegistrationManagement';
import AdminAFABundleRegistrations from './AdminAFABundleRegistrations';
import AFAAnalyticsMonitoring from './AFAAnalyticsMonitoring';
import { Settings2, DollarSign, Users, BarChart3, FileText } from 'lucide-react';

export default function AdminAFAManagementTabs() {
  return (
    <Tabs defaultValue="settings" className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" /> Settings
        </TabsTrigger>
        <TabsTrigger value="pricing" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Pricing
        </TabsTrigger>
        <TabsTrigger value="registrations" className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Registrations
        </TabsTrigger>
        <TabsTrigger value="bundles" className="flex items-center gap-2">
          <FileText className="h-4 w-4" /> Bundles
        </TabsTrigger>
        <TabsTrigger value="analytics" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Analytics
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings" className="space-y-6">
        <AdminAFASettings />
      </TabsContent>

      <TabsContent value="pricing" className="space-y-6">
        <AdminAFAPriceManager />
      </TabsContent>

      <TabsContent value="registrations" className="space-y-6">
        <AFARegistrationManagement />
      </TabsContent>

      <TabsContent value="bundles" className="space-y-6">
        <AdminAFABundleRegistrations />
      </TabsContent>

      <TabsContent value="analytics" className="space-y-6">
        <AFAAnalyticsMonitoring />
      </TabsContent>
    </Tabs>
  );
}
