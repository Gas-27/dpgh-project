# Performance Optimization Plan - Phase 1 & 2

## Current State Analysis

### Problem: 5+ Minute Page Load Times
All pages load slowly equally because of:

1. **AdminDashboard Realtime Subscriptions (CRITICAL)**
   - 6 channels listening to ALL table changes
   - Every change triggers `refreshData()` which fetches ALL records
   - Example: User places order → all 10,000 orders reload
   - Impact: If 10 orders/minute are placed, dashboard refreshes 10x/minute unnecessarily

2. **Sequential Database Queries**
   - Queries run one-after-another instead of parallel
   - 8 queries x 2 seconds each = 16 seconds minimum

3. **Fetching ALL Records (No Pagination)**
   - `fetchAllRecords()` loads all 10,000+ records into memory
   - Browser must parse, render, and store all simultaneously

4. **No Caching**
   - Every page navigation = full reload
   - No SWR or React Query caching

## Implementation Plan

### Phase 1: Quick Wins (2-3 hours)
**Target: 50% load time reduction (5 min → 2.5 min)**

1. **Optimize Realtime Subscriptions**
   - Add debouncing (wait 3 seconds before refreshing)
   - Only refresh specific table that changed, not all tables
   - Filter to only notify on relevant changes

2. **Parallel Queries Already Implemented**
   - `refreshData()` already uses `Promise.all()`
   - But individual queries fetch ALL records

3. **Optimize Select Statements**
   - Fetch only needed columns, not '*'
   - Example: Instead of selecting *, select 'id, name, status'

### Phase 2: Medium Effort (4-5 hours)
**Target: 70% load time reduction (2.5 min → 45 seconds)**

4. **Implement SWR Caching**
   - Cache data for 10-30 seconds
   - Revalidate in background
   - Prevent duplicate requests

5. **Add Suspense Boundaries**
   - Show skeleton loaders while data loads
   - Feels instant even if loading

6. **Lazy Load Dashboard Tabs**
   - Only load active tab's data initially
   - Load other tabs on-demand

## Key Changes by File

### AdminDashboard.tsx
- [ ] Add debounced realtime handler (don't refresh on every change)
- [ ] Optimize column selection in queries
- [ ] Add per-table refresh instead of all-at-once
- [ ] Implement SWR for caching
- [ ] Add Suspense boundaries

### Packages.tsx
- [ ] Implement pagination (load 50 items initially)
- [ ] Add SWR caching
- [ ] Lazy load categories

### AgentStorefront.tsx & SubagentStorefront.tsx
- [ ] Implement pagination
- [ ] Add SWR caching
- [ ] Lazy load sections

## Expected Results

### Before Optimization
```
AdminDashboard load: 5 minutes
- 2 min: realtime subscription init
- 2 min: parallel queries for 10,000+ records
- 1 min: rendering all data
```

### After Phase 1
```
AdminDashboard load: 2.5 minutes
- Debounced realtime (no initial delay)
- Optimized columns
- Same number of records but smaller payloads
```

### After Phase 2
```
AdminDashboard load: 45 seconds
- SWR caching prevents re-fetches
- Suspense shows skeleton loaders immediately
- Lazy loading tabs
- Only loads active tab initially
```

## Implementation Strategy

1. **Non-breaking changes** - All optimizations are internal
2. **Gradual rollout** - Phase 1 first, then Phase 2
3. **Monitoring** - Add console logs to measure improvements
4. **Testing** - Verify all data still loads correctly
