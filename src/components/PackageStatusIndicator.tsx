import { AlertCircle } from 'lucide-react';

export type PackageStatus = 'available' | 'not_available' | 'offline';

interface PackageStatusIndicatorProps {
  status: PackageStatus;
}

export default function PackageStatusIndicator({
  status
}: PackageStatusIndicatorProps) {
  if (status === 'available') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 mb-3 px-3 py-1 rounded-lg bg-red-50 border border-red-200 whitespace-nowrap">
      {/* RED ALERT ICON */}
      <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
      
      <p className="text-xs font-semibold text-red-700">
        Package is offline
      </p>
    </div>
  );
}
