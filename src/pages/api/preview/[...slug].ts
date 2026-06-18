import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const slug = req.query.slug as string[];
    
    if (!slug || slug.length === 0) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Extract store identifier and type from URL
    // URL format: /preview/agent/store-slug or /preview/subagent/store-slug
    const storeType = slug[0]; // 'agent' or 'subagent'
    const storeSlug = slug[1]; // store slug/name

    if (!storeType || !storeSlug || (storeType !== 'agent' && storeType !== 'subagent')) {
      return res.status(400).json({ error: 'Invalid store type' });
    }

    // Get store data from Supabase based on store type and slug
    const storeData = await fetchStoreData(storeType, storeSlug);

    if (!storeData) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Generate HTML with proper og: meta tags for social media
    const html = generatePreviewHTML(storeData, storeType);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(html);

  } catch (error) {
    console.error('[v0] Preview handler error:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
}

interface StoreData {
  id: string;
  store_name: string;
  store_tier?: string;
  store_email?: string;
  store_phone?: string;
  address?: string;
}

async function fetchStoreData(storeType: string, storeSlug: string): Promise<StoreData | null> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[v0] Missing Supabase credentials');
      return null;
    }

    const tableName = storeType === 'agent' ? 'agent_stores' : 'subagent_stores';

    // Query Supabase for store data based on store_name slug
    const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?store_name=ilike.%${storeSlug}%`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[v0] Supabase query failed: ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return data[0] as StoreData;
    }

    return null;
  } catch (error) {
    console.error('[v0] Error fetching store data:', error);
    return null;
  }
}

function generatePreviewHTML(store: StoreData, storeType: string): string {
  const storeName = store.store_name || 'Data Store';
  const storeTier = store.store_tier || 'Standard';
  const description = `Get instant data bundles from ${storeName}. Buy affordable MTN, AirtelTigo & Telecel data bundles. Fast, reliable 24/7 service.`;
  
  // Generate the preview image URL
  const previewImageParams = new URLSearchParams({
    storeId: store.id,
    storeType,
    storeName,
    storeTier,
    storeEmail: store.store_email || '',
    storePhone: store.store_phone || '',
    address: store.address || '',
  });
  
  const previewImageUrl = `/api/store-preview?${previewImageParams.toString()}`;
  const fullPreviewImageUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://datastores.shop'}${previewImageUrl}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${storeName} - Buy Affordable Data Bundles Instantly</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://datastores.shop'}">
  <meta property="og:title" content="${storeName} - Buy Affordable Data Bundles Instantly">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${fullPreviewImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/svg+xml">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://datastores.shop'}">
  <meta name="twitter:title" content="${storeName} - Buy Affordable Data Bundles Instantly">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${fullPreviewImageUrl}">
  
  <!-- Redirect to actual store page after bots crawl -->
  <script>
    // Small delay to allow bots to crawl
    setTimeout(() => {
      window.location.href = '/${storeType === 'agent' ? 'agent' : 'subagent'}/${encodeURIComponent(storeName)}';
    }, 2000);
  </script>
</head>
<body>
  <p>Loading store...</p>
</body>
</html>`;
}
