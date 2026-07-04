'use client';

import { useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export type PackageStatus = 'available' | 'not_available' | 'offline';

interface PackageStatusIndicatorProps {
  status: PackageStatus;
}

const OFFLINE_REASONS = [
  'Package server is unstable',
  'Having issues',
  'Under maintenance',
  'Network connectivity problems',
  'Service temporarily unavailable'
];

export default function PackageStatusIndicator({
  status
}: PackageStatusIndicatorProps) {
  const [expandedDropdown, setExpandedDropdown] = useState(false);

  if (status === 'available') {
    return null;
  }

  // Both offline and not_available show as "Package is offline"
  return (
    <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 border border-red-200">
      {/* RED ALERT ICON */}
      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
      
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-700">
          Package is offline
        </p>
      </div>

      {/* TAPPABLE RED INFO ICON with dropdown */}
      <div className="relative">
        <button
          onClick={() => setExpandedDropdown(!expandedDropdown)}
          className="flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-medium"
          title="Why am I seeing this?"
        >
          <span>Why?</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${expandedDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* RED DROPDOWN showing reasons */}
        {expandedDropdown && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-red-600 text-white rounded-lg shadow-lg z-50 p-3">
            <p className="text-xs font-semibold mb-2">Why am I seeing this?</p>
            <div className="space-y-1">
              {OFFLINE_REASONS.map((reason, idx) => (
                <div key={idx} className="text-xs leading-relaxed">
                  • {reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
