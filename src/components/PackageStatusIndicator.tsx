'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

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
  const [showDropdown, setShowDropdown] = useState(false);

  if (status === 'available') {
    return null;
  }

  return (
    <div className="relative inline-flex">
      <div className="flex items-center gap-1 mb-3 px-3 py-1 rounded-lg bg-red-50 border border-red-200">
        <p className="text-xs font-semibold text-red-700">
          Package is offline
        </p>
        
        {/* Small "Why?" button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
          title="Why am I seeing this?"
        >
          Why?
        </button>
      </div>

      {/* Dropdown showing reasons */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-red-600 text-white rounded-lg shadow-lg z-50 p-3">
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
  );
}
