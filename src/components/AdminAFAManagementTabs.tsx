'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminAFAPackageManager from './AdminAFAPackageManager';
import AFARegistrationManagement from './AFARegistrationManagement';
import { Box, Users } from 'lucide-react';

export default function AdminAFAManagementTabs() {
  return (
    <Tabs defaultValue="packages" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="packages" className="flex items-center gap-2">
          <Box className="h-4 w-4" /> Packages
        </TabsTrigger>
        <TabsTrigger value="registrations" className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Registrations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="packages" className="space-y-6">
        <AdminAFAPackageManager />
      </TabsContent>

      <TabsContent value="registrations" className="space-y-6">
        <AFARegistrationManagement />
      </TabsContent>
    </Tabs>
  );
}
