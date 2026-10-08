import type { NextApiRequest, NextApiResponse } from "next";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");
  const apiKey = String(req.query.api_key || "").trim();
  const network = String(req.query.network || "mtn").trim();
  if (!apiKey) return res.status(400).send("Missing api_key");

  const apiUrl = `/api/delivery-progress?api_key=${encodeURIComponent(apiKey)}&network=${encodeURIComponent(network)}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#fff;background:#0c1020}*{box-sizing:border-box}.card{max-width:100%;padding:20px;border:1px solid #5631a8;border-radius:22px;background:#351481}.row{display:flex;align-items:center;justify-content:space-between;gap:12px}.title{font-size:25px;font-weight:800}.select{border:2px solid #26c8e8;border-radius:18px;background:#fff;color:#121212;font-weight:700;font-size:18px;padding:12px 16px}.status,.last{margin-top:14px;border-radius:22px;padding:16px}.status{border:1px solid #18a7c4}.last{background:#100c29}.dot{display:inline-block;width:15px;height:15px;margin-right:10px;border-radius:50%;background:#16c784}.message{font-size:18px;font-weight:700;line-height:1.35}.estimate{margin-top:8px;font-size:16px}.muted{color:#d8d0ed}.last strong{font-size:17px}.info{margin-top:18px;line-height:1.5}.error{color:#ffd0d0;padding:16px;background:#7d202b;border-radius:14px}
</style></head><body><section class="card" aria-label="Delivery Progress"><div class="row"><div class="title">Delivery Progress</div><select class="select" id="network"><option value="mtn">MTN</option><option value="mtn_express">MTN Express</option><option value="telecel">Telecel</option><option value="airteltigo">AirtelTigo</option></select></div><div id="content" class="muted">Loading delivery status...</div></section><script>
const key=${JSON.stringify(apiKey)}, initial=${JSON.stringify(network)};const labels={mtn:'MTN',mtn_express:'MTN Express',telecel:'Telecel',airteltigo:'AirtelTigo'};const el=document.getElementById('content'), select=document.getElementById('network');select.value=labels[initial]?initial:'mtn';
function formatDate(value){return value?new Intl.DateTimeFormat('en-GH',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—'}function formatMinutes(value){if(value==null)return'—';return value<60?value+' minutes':Math.floor(value/60)+'h '+(value%60?value%60+'m':'')}
async function load(){try{const response=await fetch('/api/delivery-progress?api_key='+encodeURIComponent(key)+'&network='+encodeURIComponent(select.value));const json=await response.json();if(!response.ok)throw new Error(json.error||'Unable to load delivery status');const d=json.data,e=d.lastDelivered;el.innerHTML='<div class="status"><div class="message"><span class="dot"></span>'+escapeText(d.message)+'</div><div class="estimate">Estimated delivery: <strong>'+formatMinutes(d.estimatedDelivery.minMinutes)+' – '+formatMinutes(d.estimatedDelivery.maxMinutes)+'</strong></div></div>'+(e?'<div class="last"><strong>Last delivered: '+escapeText(e.customerNumber||'—')+'</strong><div>'+formatDate(e.placedAt)+' · Delivered '+formatDate(e.deliveredAt)+' · Took '+formatMinutes(e.durationMinutes)+'</div></div>':'<div class="last">No delivered order is available yet.</div>')+'<div class="info">This is an estimated delivery window, not a guarantee. Track an individual order for its actual status.</div>'}catch(error){el.innerHTML='<div class="error">'+escapeText(error.message)+'</div>'}}function escapeText(value){const div=document.createElement('div');div.textContent=value;return div.innerHTML}select.addEventListener('change',load);load();setInterval(load,30000);
</script></body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self';");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(html);
}
