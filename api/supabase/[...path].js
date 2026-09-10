const SUPABASE_ORIGIN = 'https://uloaiqmknsrknqikbmtb.supabase.co';

export default async function handler(req, res) {
  try {
    const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined) query.append(key, item);
      }
    }

    const target = `${SUPABASE_ORIGIN}/${path}${query.toString() ? `?${query}` : ''}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value && !['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        headers.set(key, Array.isArray(value) ? value.join(',') : value);
      }
    }

    const body = ['GET', 'HEAD'].includes(req.method || '') ? undefined : JSON.stringify(req.body);
    const response = await fetch(target, { method: req.method, headers, body });
    const responseBody = await response.arrayBuffer();

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.send(Buffer.from(responseBody));
  } catch (error) {
    res.status(502).json({ error: 'Supabase proxy request failed' });
  }
}
