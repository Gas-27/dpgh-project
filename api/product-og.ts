import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function firstImage(imageUrls: unknown): string | null {
  let list: unknown = imageUrls;
  if (typeof imageUrls === 'string') {
    try { list = JSON.parse(imageUrls); } catch { return imageUrls || null; }
  }
  if (Array.isArray(list) && typeof list[0] === 'string' && list[0]) return list[0];
  return null;
}

async function loadProduct(id: string) {
  if (!supabase) return null;
  const store = await supabase
    .from('store_products')
    .select('id,title,description,price,image_urls')
    .eq('id', id)
    .eq('status', 'active')
    .eq('available', true)
    .maybeSingle();
  if (store.data) return store.data;
  const admin = await supabase
    .from('public_store_products')
    .select('id,title,description,price,image_urls')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle();
  return admin.data || null;
}

function setMeta(html: string, attribute: 'property' | 'name', key: string, content: string) {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(`<meta\\s+${attribute}="${key}"[^>]*>`, 'i');
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function removeMeta(html: string, attribute: 'property' | 'name', key: string) {
  return html.replace(new RegExp(`\\s*<meta\\s+${attribute}="${key}"[^>]*>`, 'ig'), '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id || '');
  const wantsImage = req.query.img === '1';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const origin = host ? `${protocol}://${host}` : 'https://dataplug.store';

  const product = UUID_PATTERN.test(id) ? await loadProduct(id).catch(() => null) : null;

  if (wantsImage) {
    const source = product ? firstImage(product.image_urls) : null;
    const match = source?.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) return res.status(404).end();
    res.setHeader('Content-Type', match[1]);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(Buffer.from(match[2], 'base64'));
  }

  const templateResponse = await fetch(`${origin}/index.html`);
  let html = await templateResponse.text();

  if (product) {
    const rawImage = firstImage(product.image_urls);
    let image = '';
    if (rawImage) {
      if (/^https?:\/\//i.test(rawImage)) image = rawImage;
      else if (rawImage.startsWith('data:image/')) image = `${origin}/api/product-og?id=${product.id}&img=1`;
      else if (rawImage.startsWith('/')) image = `${origin}${rawImage}`;
    }
    const title = String(product.title || 'Product');
    const price = Number(product.price);
    const baseDescription = String(product.description || '').trim();
    const description = (Number.isFinite(price) ? `GHS ${price.toFixed(2)}${baseDescription ? ' - ' : ''}` : '') + baseDescription || `Product details for ${title}.`;
    const url = `${origin}/marketplace/product/${product.id}`;

    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(url)}" />`);
    html = setMeta(html, 'property', 'og:type', 'product');
    html = setMeta(html, 'property', 'og:title', title);
    html = setMeta(html, 'property', 'og:description', description);
    html = setMeta(html, 'property', 'og:url', url);
    html = setMeta(html, 'name', 'twitter:title', title);
    html = setMeta(html, 'name', 'twitter:description', description);
    html = setMeta(html, 'name', 'description', description);

    if (image) {
      html = setMeta(html, 'property', 'og:image', image);
      html = setMeta(html, 'property', 'og:image:alt', title);
      html = setMeta(html, 'name', 'twitter:image', image);
      html = setMeta(html, 'name', 'twitter:image:alt', title);
      html = removeMeta(html, 'property', 'og:image:width');
      html = removeMeta(html, 'property', 'og:image:height');
      html = removeMeta(html, 'property', 'og:image:type');
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(html);
}
