'use client';

import { useState } from 'react';

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
      <div className="flex items-center gap-1 mb-3 px-3 py-1 rounded-lg bg-red-50 border border-red-200 whitespace-nowrap">
        <p className="text-xs font-semibold text-red-700">
          Package is offline
        </p>
        
        {/* Very small "Why?" button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="text-[10px] text-red-600 hover:text-red-700 font-medium cursor-pointer ml-0.5"
          title="Why am I seeing this?"
        >
          Why?
        </button>
      </div>

      {/* Dropdown showing reasons - compact with left alignment */}
      {showDropdown && (
        <div className="fixed bg-red-600 text-white rounded-lg shadow-lg z-50 p-3" style={{ width: 'auto', minWidth: '220px', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <p className="text-xs font-semibold mb-2 text-left">Why am I seeing this?</p>
          <div className="space-y-1.5">
            {OFFLINE_REASONS.map((reason, idx) => (
              <div key={idx} className="text-xs leading-snug text-left">
                • {reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
