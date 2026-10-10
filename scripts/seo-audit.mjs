import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
const editorial = fs.readFileSync(path.join(root, "src/data/ghana-editorial-library.ts"), "utf8");
const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]);
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace("https://dataplug.store", ""));
const published = [...editorial.matchAll(/slug: "([^"]+)"[\s\S]*?status: "published"/g)].map((match) => match[1]);
const privateRoutes = routes.filter((route) => /dashboard|admin|login|signup|callback|payment|registration|reset/.test(route));
const missingSitemap = routes.filter((route) => route.startsWith("/") && !route.includes(":") && !privateRoutes.includes(route) && !sitemapUrls.includes(route) && route !== "*");
console.log(JSON.stringify({ routeCount: routes.length, sitemapCount: sitemapUrls.length, publishedEditorialCount: published.length, privateRouteCount: privateRoutes.length, missingSitemap }, null, 2));
// The audit is intentionally report-only: missing URLs require editorial review before inclusion.

