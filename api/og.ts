import { ImageResponse } from "@vercel/og";
import { PAGES } from "../src/data/seo/pages.mjs";
import { GUIDES, getGuide } from "../src/data/seo/guides.mjs";

const FALLBACK_TITLE = "Cheap Data, Airtime, Subscriptions & Bills in Ghana";

function resolveContent(page: string, slug: string | null) {
  if (page === "guide" && slug) {
    const guide: any = getGuide(slug);
    if (guide) return { eyebrow: "Guide", title: guide.h1 };
  }
  if (page === "guides") return { eyebrow: "Guides", title: "Data, Bills, Subscriptions & Growth in Ghana" };
  const entry: any = Object.values(PAGES).find((p: any) => p.path === (page === "home" ? "/" : `/${page}`));
  if (entry) return { eyebrow: page === "home" ? "Ghana" : "JustBuy GH", title: entry.h1 as string };
  return { eyebrow: "Ghana", title: FALLBACK_TITLE };
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { eyebrow, title } = resolveContent(searchParams.get("page") ?? "home", searchParams.get("slug"));
  void GUIDES;

  return new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0a0e1a",
          color: "#ffffff",
        },
        children: [
          {
            type: "div",
            props: {
              style: { display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700 },
              children: [
                {
                  type: "div",
                  props: {
                    style: { width: 20, height: 20, borderRadius: 10, background: "#22d3ee" },
                  },
                },
                { type: "span", props: { children: "JustBuy GH" } },
              ],
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", flexDirection: "column", gap: 24 },
              children: [
                {
                  type: "div",
                  props: { style: { fontSize: 30, color: "#22d3ee", textTransform: "uppercase", letterSpacing: 4 }, children: eyebrow },
                },
                {
                  type: "div",
                  props: { style: { fontSize: 64, fontWeight: 800, lineHeight: 1.1 }, children: title },
                },
              ],
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", justifyContent: "space-between", fontSize: 30, color: "#fbbf24" },
              children: [
                { type: "span", props: { children: "MTN - Telecel - AirtelTigo" } },
                { type: "span", props: { children: "Dial *365*778#" } },
              ],
            },
          },
        ],
      },
    } as any,
    { width: 1200, height: 630 },
  );
}
