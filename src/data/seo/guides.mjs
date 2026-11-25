import { DATA_GUIDES } from "./guides-data.mjs";
import { BILLS_GUIDES } from "./guides-bills.mjs";
import { DIGITAL_GUIDES } from "./guides-digital.mjs";

export const GUIDES = [...DATA_GUIDES, ...BILLS_GUIDES, ...DIGITAL_GUIDES];

export const GUIDE_BY_SLUG = Object.fromEntries(GUIDES.map((guide) => [guide.slug, guide]));

export function getGuide(slug) {
  return GUIDE_BY_SLUG[slug] ?? null;
}

export const GUIDES_INDEX = {
  path: "/guides",
  metaTitle: "Guides: Cheap Data, ECG, DStv & More in Ghana",
  description:
    "Free guides on buying cheap data, ECG electricity, DStv, subscriptions and bulk SMS in Ghana, plus how to start a reseller business. Read now.",
  keywords: ["cheap data Ghana", "buy data online Ghana", "how to make money online in Ghana", "data reseller Ghana"],
  h1: "JustBuy GH Guides: Data, Bills, Subscriptions & Growth in Ghana",
  intro:
    "Practical, step-by-step guides on buying cheap data, paying bills with MoMo, using subscriptions and growing a small business in Ghana.",
};
