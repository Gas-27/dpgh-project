import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const origin = "https://dataplug.store";
const routes = ["/", "/packages", "/become-agent", "/blog", "/about", "/contact", "/mtn-data-bundles", "/telecel-data-bundles", "/airteltigo-data-bundles", "/cheap-data-bundles-ghana", "/data-reseller-agent-ghana", "/data-api-ghana", "/streaming-data-bundles-ghana", "/student-data-bundles-ghana", "/airtime-top-up-ghana", "/premium-subscription", "/data-agent-business-ghana", "/ussd-data-services-ghana", "/bece-results-checker", "/wassce-results-checker", "/buy-data-online-ghana", "/wholesale-data-bundles-ghana", "/internet-bundles-ghana", "/become-sub-agent", "/afa-bundle-ghana", "/data-bundle-prices-ghana", "/privacy-policy", "/terms", "/refund-policy", "/cookie-policy"];
const editorial = fs.readFileSync(path.join(root, "src/data/ghana-editorial-library.ts"), "utf8");
const published = [...editorial.matchAll(/slug: "(\/blog\/[^\"]+)"[\s\S]*?status: "published"/g)].map((m) => m[1]);
const unique = [...new Set([...routes, ...published])];
const priority = (route) => route === "/" ? "1.0" : ["/packages", "/blog"].includes(route) ? "0.9" : route.startsWith("/blog/") ? "0.7" : route.includes("privacy") || route.includes("terms") || route.includes("cookie") ? "0.3" : "0.8";
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map((route) => `  <url><loc>${origin}${route === "/" ? "/" : route.replace(/\/$/, "")}</loc><changefreq>${route.startsWith("/blog/") ? "monthly" : "weekly"}</changefreq><priority>${priority(route)}</priority></url>`).join("\n")}\n</urlset>\n`;
fs.writeFileSync(path.join(root, "public/sitemap.xml"), xml);
console.log(`Generated ${unique.length} canonical URLs.`);
