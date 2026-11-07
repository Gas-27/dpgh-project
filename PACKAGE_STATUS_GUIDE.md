# Package Status Indicator System

## Overview
This system provides a comprehensive way to display package availability status with detailed explanations for why a package is unavailable or offline.

## Components

### 1. PackageStatusIndicator Component
Location: `src/components/PackageStatusIndicator.tsx`

This component displays status badges with expandable explanations.

**Props:**
- `status: PackageStatus` - 'available' | 'not_available' | 'offline'
- `packageName: string` - The name of the package

**Features:**
- Shows appropriate colored badge (red for offline, gray for not available)
- Red alert icon for offline packages
- "Why am I seeing this?" help icon
- Expandable dropdown with predefined reasons for the status
- Mobile-friendly design

## Integration Points

### AFA Packages (AFAPackagesDisplay.tsx)
Displays in the "Activate AFA Bundle" section.

**Required Database Fields:**
- `is_active` (boolean) - Whether package is active
- `is_online` (boolean, optional) - Whether package server is online

**Status Logic:**
```typescript
const packageStatus: PackageStatus = 
  pkg.is_online === false ? 'offline' : 
  (pkg.is_active ? 'available' : 'not_available');
```

### Data Packages (Packages.tsx)
Displays in the main packages section.

**Required Database Fields:**
- `active` (boolean) - Whether package is active
- `is_online` (boolean, optional) - Whether package server is online
- `offline_reason` (string, optional) - Custom reason for being offline

**Status Logic:**
```typescript
const packageStatus: PackageStatus = 
  pkg.is_online === false ? 'offline' : 
  (isInactive ? 'not_available' : 'available');
```

## Status Types

### 1. Available
- Package is active and online
- No status indicator shown
- Buy button is enabled

### 2. Not Available
- Package exists but is inactive/deactivated
- Gray badge shown: "Package Not Available"
- Shows reasons why (quota reached, being updated, etc.)
- Buy button is disabled

### 3. Offline
- Package server is unstable, has issues, or under maintenance
- Red badge shown: "Package is Currently Offline"
- Shows detailed reasons:
  - Server Unstable
  - Having Issues
  - Under Maintenance
  - Network Problems
  - Service Unavailable
- Buy button is disabled
- Red alert icon emphasizes urgency

## Database Schema Updates

To fully utilize this system, update your package tables:

```sql
ALTER TABLE afa_packages ADD COLUMN is_online BOOLEAN DEFAULT true;
ALTER TABLE afa_packages ADD COLUMN offline_reason TEXT;

ALTER TABLE data_packages ADD COLUMN is_online BOOLEAN DEFAULT true;
ALTER TABLE data_packages ADD COLUMN offline_reason TEXT;
```

## Usage in Admin Dashboard

To update package status:

```typescript
// Set package as offline
await supabase
  .from('afa_packages')
  .update({ is_online: false })
  .eq('id', packageId);

// Set package as back online
await supabase
  .from('afa_packages')
  .update({ is_online: true })
  .eq('id', packageId);

// Deactivate package
await supabase
  .from('afa_packages')
  .update({ is_active: false })
  .eq('id', packageId);
```

## Visual Design

- **Offline Status**: Red background, red alert icon, red border
- **Not Available Status**: Gray background, standard border
- **Help Icon**: Clickable question mark for explanations
- **Dropdown**: Reveals specific reasons with descriptions

## Future Enhancements

1. Custom offline reasons per package
2. Admin interface to set status and reasons
3. Automatic status detection based on API health
4. Status change notifications
5. Analytics on package unavailability patterns
