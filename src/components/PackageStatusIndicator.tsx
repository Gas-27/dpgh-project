'use client';

import { useState } from 'react';
import { ChevronDown, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type PackageStatus = 'available' | 'not_available' | 'offline';

interface StatusReason {
  title: string;
  description: string;
}

interface PackageStatusIndicatorProps {
  status: PackageStatus;
  packageName: string;
}

const STATUS_REASONS: Record<PackageStatus, StatusReason[]> = {
  'available': [
    { title: 'Active', description: 'This package is currently available for purchase' }
  ],
  'not_available': [
    { title: 'Package Not Available', description: 'This package is no longer available for purchase at this time' },
    { title: 'Limited Availability', description: 'The package may have reached its quota or is being updated' }
  ],
  'offline': [
    { title: 'Server Unstable', description: 'The package server is experiencing stability issues and may not respond reliably' },
    { title: 'Having Issues', description: 'The package service is currently experiencing technical difficulties' },
    { title: 'Under Maintenance', description: 'The package service is undergoing scheduled maintenance to improve performance' },
    { title: 'Network Problems', description: 'There are temporary network connectivity issues affecting this package' },
    { title: 'Service Unavailable', description: 'The package service is temporarily unavailable. Please try again later' }
  ]
};

export default function PackageStatusIndicator({
  status,
  packageName
}: PackageStatusIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const reasons = STATUS_REASONS[status];

  if (status === 'available') {
    return null;
  }

  const isOffline = status === 'offline';
  const bgColor = isOffline ? 'bg-red-50 dark:bg-red-950' : 'bg-gray-50 dark:bg-gray-900';
  const borderColor = isOffline ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-800';
  const textColor = isOffline ? 'text-red-900 dark:text-red-100' : 'text-gray-900 dark:text-gray-100';
  const badgeText = isOffline ? 'Package is Currently Offline' : 'Package Not Available';
  const badgeBg = isOffline ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-800';
  const badgeTextColor = isOffline ? 'text-red-700 dark:text-red-200' : 'text-gray-700 dark:text-gray-200';

  return (
    <div className={`border rounded-lg p-3 ${bgColor} ${borderColor}`}>
      <div className="flex items-start gap-2">
        {isOffline && (
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-sm font-semibold ${badgeTextColor} ${badgeBg} px-2 py-1 rounded`}>
              {badgeText}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-white/20"
              title="Why am I seeing this?"
            >
              <HelpCircle className={`h-4 w-4 ${isOffline ? 'text-red-600' : 'text-gray-600'} dark:${isOffline ? 'text-red-400' : 'text-gray-400'}`} />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={`w-full justify-between p-0 h-auto text-sm ${textColor} hover:bg-white/10`}
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-xs font-medium">Why am I seeing this?</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>

          {expanded && (
            <div className="mt-2 space-y-2 pt-2 border-t border-current border-opacity-20">
              {reasons.map((reason, idx) => (
                <div key={idx} className="text-xs">
                  <p className="font-semibold mb-1">{reason.title}</p>
                  <p className="opacity-75">{reason.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
