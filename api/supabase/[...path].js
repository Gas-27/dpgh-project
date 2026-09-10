const SUPABASE_ORIGIN = 'https://uloaiqmknsrknqikbmtb.supabase.co';

module.exports = async function handler(req, res) {
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam) ? pathParam.join('/') : pathParam || '';

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== undefined) query.append(key, String(item));
    }
  }

  const target = `${SUPABASE_ORIGIN}/${path}${query.toString() ? `?${query}` : ''}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value && !['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  }

  try {
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
  } catch (err) {
    console.error('[api/supabase proxy] error:', err.message);
    res.status(502).json({ error: 'Failed to reach Supabase', details: err.message });
  }
};
