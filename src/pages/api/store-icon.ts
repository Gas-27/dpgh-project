import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { name = 'D', color = '667eea' } = req.query;
    
    // Get first letter
    const letter = String(name).charAt(0).toUpperCase();
    
    // Generate SVG with letter
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#${color};stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#grad)"/>
        <text x="600" y="360" font-size="280" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif">
          ${letter}
        </text>
      </svg>
    `;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(200).send(svg);
  } catch (error) {
    console.error('[v0] Store icon error:', error);
    return res.status(500).json({ error: 'Failed to generate icon' });
  }
}
