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
    <div className="relative w-full">
      {/* Badge - keep on one line */}
      <div className="flex items-center gap-1.5 mb-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
        <p className="text-xs font-semibold text-red-700">
          Package is offline
        </p>
        
        {/* Tap to see why button with dropdown icon */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-0.5 text-[10px] text-red-600 hover:text-red-700 font-medium cursor-pointer whitespace-nowrap"
          title="Why am I seeing this?"
        >
          <span>Tap to see why?</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Helper text for scrolling */}
      <p className="text-[9px] text-red-500 mb-2 leading-tight">
        Scroll down to see available packages
      </p>

      {/* Dropdown showing reasons */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-full bg-red-600 text-white rounded-lg shadow-lg z-50 p-3 max-w-xs">
          <p className="text-[11px] font-semibold mb-2 text-left">Why am I seeing this?</p>
          <div className="space-y-1.5">
            {OFFLINE_REASONS.map((reason, idx) => (
              <div key={idx} className="text-[10px] leading-snug text-left">
                • {reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
