import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Check if this is a store URL (agent or subagent)
  const agentMatch = pathname.match(/^\/agent\/(.+)$/);
  const subagentMatch = pathname.match(/^\/subagent\/(.+)$/);

  if (agentMatch || subagentMatch) {
    const storeType = agentMatch ? 'agent' : 'subagent';
    const storeName = agentMatch ? agentMatch[1] : subagentMatch![1];

    // Check if the request is from a social media bot/crawler
    const userAgent = request.headers.get('user-agent') || '';
    const isBotCrawler = /bot|crawler|facebookexternalhit|whatsapp|twitterbot|slurp|yandexbot|bingbot|googlebot/i.test(userAgent);

    console.log(`[v0] Middleware - Path: ${pathname}, StoreType: ${storeType}, StoreName: ${storeName}, IsBot: ${isBotCrawler}`);

    if (isBotCrawler) {
      // Redirect bots to preview endpoint
      const previewUrl = new URL(`/api/preview/${storeType}/${encodeURIComponent(storeName)}`, request.url);
      console.log(`[v0] Redirecting bot to preview: ${previewUrl.toString()}`);
      return NextResponse.redirect(previewUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match store pages
    '/agent/:path*',
    '/subagent/:path*',
  ],
};
