import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId, storeType } = req.query;

  if (!storeId || !storeType) {
    return res.status(400).json({ error: 'Missing storeId or storeType' });
  }

  // Generate SVG preview image
  const storeName = (req.query.storeName as string) || 'Data Store';
  const storeTier = (req.query.storeTier as string) || 'Standard';
  const storeEmail = (req.query.storeEmail as string) || '';
  const storePhone = (req.query.storePhone as string) || '';
  const address = (req.query.address as string) || '';

  const svg = generatePreviewSVG({
    storeName,
    storeTier,
    storeEmail,
    storePhone,
    address,
    storeType: storeType as string,
  });

  // Set response headers for SVG
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
}

interface PreviewParams {
  storeName: string;
  storeTier: string;
  storeEmail: string;
  storePhone: string;
  address: string;
  storeType: string;
}

function generatePreviewSVG(params: PreviewParams): string {
  const { storeName, storeTier, storeEmail, storePhone, address, storeType } = params;

  // Color scheme
  const primaryColor = '#2563eb';
  const backgroundColor = '#ffffff';
  const textColor = '#1f2937';
  const secondaryColor = '#f3f4f6';

  // Dimensions
  const width = 1200;
  const height = 630;

  // Tier badge colors
  const tierColors: Record<string, string> = {
    'premium': '#fbbf24',
    'gold': '#f59e0b',
    'silver': '#d1d5db',
    'bronze': '#b45309',
    'standard': '#60a5fa',
  };

  const tierColor = tierColors[storeTier.toLowerCase()] || tierColors['standard'];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
  
  <!-- Gradient overlay -->
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.05" />
      <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0.1" />
    </linearGradient>
    <linearGradient id="tierGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${tierColor};stop-opacity:0.2" />
      <stop offset="100%" style="stop-color:${tierColor};stop-opacity:0.05" />
    </linearGradient>
  </defs>
  
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
  
  <!-- Top border accent -->
  <rect width="${width}" height="8" fill="${primaryColor}"/>
  
  <!-- Main content container -->
  <g>
    <!-- Logo/Icon circle -->
    <circle cx="120" cy="120" r="80" fill="${secondaryColor}" opacity="0.8"/>
    <circle cx="120" cy="120" r="70" fill="${primaryColor}" opacity="0.1"/>
    
    <!-- Icon letter -->
    <text x="120" y="145" font-size="72" font-weight="bold" fill="${primaryColor}" text-anchor="middle" font-family="Arial, sans-serif">
      ${storeName.charAt(0).toUpperCase()}
    </text>
  </g>
  
  <!-- Store information -->
  <g>
    <!-- Store name -->
    <text x="260" y="100" font-size="56" font-weight="bold" fill="${textColor}" font-family="Arial, sans-serif" text-anchor="start">
      ${escapeSVG(storeName)}
    </text>
    
    <!-- Tier badge -->
    <rect x="260" y="130" width="240" height="50" rx="8" fill="url(#tierGrad)" stroke="${tierColor}" stroke-width="2"/>
    <text x="380" y="165" font-size="24" font-weight="600" fill="${tierColor}" text-anchor="middle" font-family="Arial, sans-serif">
      ${escapeSVG(storeTier.toUpperCase())} TIER
    </text>
    
    <!-- Divider line -->
    <line x1="260" y1="210" x2="1100" y2="210" stroke="${secondaryColor}" stroke-width="2"/>
    
    <!-- Contact information section -->
    <text x="260" y="270" font-size="20" font-weight="600" fill="${textColor}" font-family="Arial, sans-serif">
      Contact Information
    </text>
    
    <!-- Email -->
    <text x="280" y="320" font-size="18" fill="#6b7280" font-family="Arial, sans-serif">
      📧 ${escapeSVG(storeEmail || 'Email not provided')}
    </text>
    
    <!-- Phone -->
    <text x="280" y="360" font-size="18" fill="#6b7280" font-family="Arial, sans-serif">
      📱 ${escapeSVG(storePhone || 'Phone not provided')}
    </text>
    
    <!-- Address -->
    <text x="280" y="400" font-size="18" fill="#6b7280" font-family="Arial, sans-serif">
      📍 ${escapeSVG(address ? address.substring(0, 60) : 'Location not provided')}
    </text>
    
    <!-- Store type badge -->
    <rect x="260" y="480" width="400" height="60" rx="8" fill="${primaryColor}" opacity="0.1" stroke="${primaryColor}" stroke-width="2"/>
    <text x="460" y="520" font-size="22" font-weight="bold" fill="${primaryColor}" text-anchor="middle" font-family="Arial, sans-serif">
      ${storeType === 'agent' ? '🏪 AGENT STORE' : '🤝 SUBAGENT STORE'}
    </text>
    
    <!-- Footer tagline -->
    <text x="${width / 2}" y="${height - 40}" font-size="18" fill="#9ca3af" text-anchor="middle" font-family="Arial, sans-serif">
      Buy Affordable Data Bundles Instantly | 24/7 Service
    </text>
  </g>
</svg>`;
}

function escapeSVG(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
