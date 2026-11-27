import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const origin = "https://dataplug.store";
const routes = ["/", "/packages", "/become-agent", "/blog", "/about", "/contact", "/mtn-data-bundles", "/telecel-data-bundles", "/airteltigo-data-bundles", "/cheap-data-bundles-ghana", "/data-reseller-agent-ghana", "/data-api-ghana", "/streaming-data-bundles-ghana", "/student-data-bundles-ghana", "/airtime-top-up-ghana", "/premium-subscription", "/data-agent-business-ghana", "/ussd-data-services-ghana", "/bece-results-checker", "/wassce-results-checker", "/buy-data-online-ghana", "/wholesale-data-bundles-ghana", "/internet-bundles-ghana", "/become-sub-agent", "/afa-bundle-ghana", "/data-bundle-prices-ghana", "/games", "/privacy-policy", "/terms", "/refund-policy", "/cookie-policy"];
const editorial = fs.readFileSync(path.join(root, "src/data/ghana-editorial-library.ts"), "utf8");
const published = [...editorial.matchAll(/slug: "(\/blog\/[^\"]+)"[\s\S]*?status: "published"/g)].map((m) => m[1]);
const additional = fs.readFileSync(path.join(root, "src/data/ghana-additional-articles.ts"), "utf8");
const additionalIds = [...additional.matchAll(/id:\"([^\"]+)\"/g)].map((m) => `/blog/${m[1]}-ghana`);
const unique = [...new Set([...routes, ...published, ...additionalIds])];
const priority = (route) => route === "/" ? "1.0" : ["/packages", "/blog"].includes(route) ? "0.9" : route.startsWith("/blog/") ? "0.7" : route.includes("privacy") || route.includes("terms") || route.includes("cookie") ? "0.3" : "0.8";
const lastmod = new Date().toISOString().slice(0, 10);
const escapeXml = (value) => value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" })[character]);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map((route) => {
  const loc = `${origin}${route === "/" ? "/" : route.replace(/\/$/, "")}`;
  const changefreq = route.startsWith("/blog/") ? "monthly" : route.includes("privacy") || route.includes("terms") || route.includes("cookie") ? "yearly" : "weekly";
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority(route)}</priority>
  </url>`;
}).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(root, "public/sitemap-default.xml"), xml);
console.log(`Generated ${unique.length} canonical URLs.`);

// ---- justbuygh.com sitemap + robots (served per host via vercel.json rewrites) ----
const { SITE, absoluteUrl } = await import("../src/data/seo/site.mjs");
const { PAGES } = await import("../src/data/seo/pages.mjs");
const { GUIDES } = await import("../src/data/seo/guides.mjs");

const justBuyEntries = [
  ...Object.values(PAGES).map((page) => ({
    loc: absoluteUrl(page.path),
    changefreq: page.path === "/" || page.path === "/packages" || page.path === "/subscription" ? "daily" : "weekly",
    priority: ["/", "/packages", "/subscription"].includes(page.path) ? "1.0" : "0.8",
  })),
  { loc: absoluteUrl("/guides"), changefreq: "weekly", priority: "0.8" },
  ...GUIDES.map((guide) => ({ loc: absoluteUrl(`/guides/${guide.slug}`), changefreq: "monthly", priority: "0.7", lastmod: guide.updated })),
];
const justBuyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${justBuyEntries.map((entry) => `  <url><loc>${escapeXml(entry.loc)}</loc><lastmod>${entry.lastmod || lastmod}</lastmod><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(root, "public/sitemap-justbuygh.xml"), justBuyXml);

const justBuyRobots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin-only
Disallow: /only-admin
Disallow: /sub-admin
Disallow: /dashboard
Disallow: /user-dashboard
Disallow: /agent-dashboard
Disallow: /subagent-dashboard
Disallow: /sub-subagent-dashboard
Disallow: /api/
Disallow: /auth/
Disallow: /login
Disallow: /signup
Disallow: /reset-password
Disallow: /verify-email
Disallow: /wallet
Disallow: /checkout
Disallow: /account
Disallow: /agent/
Disallow: /agent-registration-callback
Disallow: /subagent-registration/
Disallow: /sub-subagent-registration/
Disallow: /subagent-approval-payment
Disallow: /verify-subagent-payment
Disallow: /subagent-payment-complete
Disallow: /pending-approval
Disallow: /private-subscription/
Disallow: /service-access/

Sitemap: ${SITE.origin}/sitemap.xml
`;
fs.writeFileSync(path.join(root, "public/robots-justbuygh.txt"), justBuyRobots);
console.log(`Generated ${justBuyEntries.length} justbuygh.com URLs.`);
