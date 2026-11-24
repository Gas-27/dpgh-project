'use client';

import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';

export type PackageStatus = 'available' | 'not_available' | 'offline';

interface PackageStatusIndicatorProps {
  status: PackageStatus;
  /** Text written by the admin when the package was turned off. */
  note?: string | null;
}

const OFFLINE_REASONS = [
  'Package server is unstable',
  'Having issues',
  'Under maintenance',
  'Network connectivity problems',
  'Service temporarily unavailable'
];

const DEFAULT_UNAVAILABLE_NOTE = 'This package is currently unavailable. Please check back later.';

export default function PackageStatusIndicator({
  status,
  note
}: PackageStatusIndicatorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  if (status === 'available') {
    return null;
  }

  if (status === 'not_available') {
    const message = note?.trim() || DEFAULT_UNAVAILABLE_NOTE;
    return (
      <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
          <p className="text-xs font-semibold text-red-700">Currently unavailable</p>
          <button
            type="button"
            onClick={() => setShowDropdown((v) => !v)}
            aria-label="Why is this package unavailable?"
            aria-expanded={showDropdown}
            className="flex h-5 w-5 items-center justify-center rounded-full text-red-600 hover:bg-red-100 hover:text-red-700"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
        {showDropdown && (
          <div role="status" className="mb-2 w-full rounded-lg bg-red-600 p-3 text-left text-white shadow-lg">
            <p className="whitespace-pre-wrap break-words text-[11px] leading-snug">{message}</p>
          </div>
        )}
      </div>
    );
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
