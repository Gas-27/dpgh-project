# Social Media Preview Setup Guide

## Overview

This system automatically generates custom store preview images when store links are shared on social media platforms (WhatsApp, Facebook, Twitter, etc.).

## How It Works

1. **User shares store link**: Agent/Subagent copies and shares their store URL (e.g., `https://nnnn.datastores.shop/agent/MyStore`)

2. **Middleware intercepts bot requests**: When a social media crawler accesses the link, the middleware detects it's a bot and redirects to the preview API

3. **Preview API generates HTML**: The preview API:
   - Fetches store data from Supabase
   - Generates a custom preview image with store information
   - Returns HTML with proper OpenGraph meta tags

4. **Social media displays preview**: Facebook, WhatsApp, Twitter etc. show the custom store preview instead of the generic DATA PLUG icon

## Components

### 1. Vercel Middleware (`middleware.ts`)
- Intercepts requests to `/agent/*` and `/subagent/*` paths
- Detects if request is from a social media bot (WhatsApp, Facebook, Twitter, etc.)
- Redirects bots to the preview API endpoint
- Regular users see the app normally

### 2. Store Preview API (`/api/store-preview.ts`)
- Accepts store parameters (name, tier, email, phone, address, type)
- Generates a professional SVG preview image
- Returns image with proper cache headers for social media

### 3. Preview Handler (`/api/preview/[...slug].ts`)
- Handles requests from the middleware
- Queries Supabase for store data
- Generates HTML with OpenGraph meta tags
- Includes the generated preview image
- Auto-redirects user to actual store after 2 seconds

## Setup Steps

### Step 1: Ensure Middleware is Deployed

The middleware file (`middleware.ts`) is already created. When you deploy to Vercel, it will automatically:
- Intercept store URLs
- Detect social media crawlers
- Redirect them to the preview API

### Step 2: Verify Supabase Edge Function

You need the preview API as a Supabase Edge Function. Here's the code:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

interface StoreData {
  id: string;
  store_name: string;
  store_tier?: string;
  store_email?: string;
  store_phone?: string;
  address?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter((p) => p);

    const previewIndex = pathParts.indexOf("preview");
    if (previewIndex === -1 || previewIndex + 2 >= pathParts.length) {
      return new Response(JSON.stringify({ error: "Invalid request path" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const storeType = pathParts[previewIndex + 1];
    const storeSlug = pathParts[previewIndex + 2];

    if (!storeType || !storeSlug || (storeType !== "agent" && storeType !== "subagent")) {
      return new Response(JSON.stringify({ error: "Invalid store type" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`[v0] Preview request: storeType=${storeType}, storeSlug=${storeSlug}`);

    const storeData = await fetchStoreData(storeType, storeSlug);

    if (!storeData) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const html = generatePreviewHTML(storeData, storeType);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("[v0] Preview handler error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate preview" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

async function fetchStoreData(storeType: string, storeSlug: string): Promise<StoreData | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials");
      return null;
    }

    const tableName = storeType === "agent" ? "agent_stores" : "subagent_stores";
    const decodedSlug = decodeURIComponent(storeSlug);

    const response = await fetch(
      `${supabaseUrl}/rest/v1/${tableName}?store_name=ilike.%${encodeURIComponent(decodedSlug)}%`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

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
    console.error("[v0] Error fetching store data:", error);
    return null;
  }
}

function generatePreviewHTML(store: StoreData, storeType: string): string {
  const storeName = store.store_name || "Data Store";
  const storeTier = store.store_tier || "Standard";
  const description = `Get instant data bundles from ${storeName}. Buy affordable MTN, AirtelTigo & Telecel data bundles. Fast, reliable 24/7 service.`;

  const previewImageParams = new URLSearchParams({
    storeId: store.id,
    storeType,
    storeName,
    storeTier,
    storeEmail: store.store_email || "",
    storePhone: store.store_phone || "",
    address: store.address || "",
  });

  const baseUrl = Deno.env.get("SUPABASE_URL") || "https://datastores.shop";
  const previewImageUrl = `/api/store-preview?${previewImageParams.toString()}`;
  const fullPreviewImageUrl = `${baseUrl}${previewImageUrl}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${storeName} - Buy Affordable Data Bundles Instantly</title>
  <meta name="description" content="${description}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://datastores.shop">
  <meta property="og:title" content="${storeName} - Buy Affordable Data Bundles Instantly">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${fullPreviewImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/svg+xml">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://datastores.shop">
  <meta name="twitter:title" content="${storeName} - Buy Affordable Data Bundles Instantly">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${fullPreviewImageUrl}">
  
  <script>
    setTimeout(() => {
      const storeType = "${storeType}";
      const storeName = "${storeName.replace(/"/g, '\\"')}";
      const redirectUrl = storeType === 'agent' 
        ? '/agent/' + encodeURIComponent(storeName)
        : '/subagent/' + encodeURIComponent(storeName);
      window.location.href = redirectUrl;
    }, 2000);
  </script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      color: white;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Loading store...</p>
  </div>
</body>
</html>`;
}
```

### Step 3: Deploy to Vercel

1. Push your changes to GitHub
2. Vercel will auto-deploy
3. Middleware will start working automatically

### Step 4: Test

1. Have an agent/subagent share their store link on WhatsApp/Facebook
2. The preview should now show the custom store preview image instead of DATA PLUG icon
3. When someone opens the link, it redirects to the actual store

## How It Looks

When shared on social media:
- **Title**: Store name
- **Description**: Data bundle message
- **Image**: Custom preview with store name, tier, contact info, and store type badge
- **No more DATA PLUG icon**

## Troubleshooting

### Preview not showing on social media
1. Clear social media link cache (share a new URL or use Facebook/Twitter debugger)
2. Check Vercel logs for middleware errors
3. Verify Supabase Edge Function is deployed and working

### Store data not fetching
1. Verify store name in database matches exactly
2. Check Supabase API is accessible
3. Ensure SERVICE_ROLE_KEY has proper permissions

### Image not rendering
1. Check `/api/store-preview` endpoint is accessible
2. Verify SVG is being generated without errors
3. Test with browser developer tools network tab

## Files Modified

- `middleware.ts` - New file for bot detection and redirection
- `src/pages/api/store-preview.ts` - Image generation API (already exists)
- `src/pages/api/preview/[...slug].ts` - Preview handler (already exists)
