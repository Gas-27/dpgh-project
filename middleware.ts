import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  
  // List of base domains to check
  const BASE_DOMAINS = ['dataplug.store', 'www.dataplug.store'];
  
  // Check if accessing from base dataplug.store domain
  const isBaseDomain = BASE_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );

  // If on base dataplug.store and trying to access storefront
  if (isBaseDomain && pathname.startsWith('/')) {
    // Extract store name from URL query parameter or path
    const storeParam = request.nextUrl.searchParams.get('store');
    
    if (storeParam) {
      // Sanitize store name for subdomain
      const sanitized = sanitizeStoreName(storeParam);
      // Redirect to subdomain URL
      return NextResponse.redirect(new URL(`https://${sanitized}.datastores.shop${pathname}`, request.url));
    }
  }

  // Check for agent store subdomain (storename.datastores.shop)
  if (hostname.endsWith('.datastores.shop') && !BASE_DOMAINS.includes(hostname)) {
    // Allow access - subdomain routing is correct
    return NextResponse.next();
  }

  // Check for subagent store domain (agentsstore.shop)
  if (hostname === 'agentsstore.shop' || hostname === 'www.agentsstore.shop') {
    // Allow access - subagent domain is correct
    return NextResponse.next();
  }

  // For other domains, allow through
  return NextResponse.next();
}

// Sanitize store name for URL (same logic as frontend)
function sanitizeStoreName(storeName: string): string {
  return storeName
    .toLowerCase()
    .trim()
    .replace(/'/g, '')
    .replace(/\./g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
