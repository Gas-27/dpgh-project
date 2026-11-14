type ProductMessageInput = {
  title: string;
  description?: string | null;
  price: number | string;
  productUrl: string;
  imageUrl?: string | null;
};

const MAX_DESCRIPTION_LENGTH = 200;
const MAX_IMAGE_URL_LENGTH = 500;

export function whatsappDigits(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("233")) return digits.slice(0, 12);
  if (digits.startsWith("0")) return `233${digits.slice(1, 10)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

// Uploaded images can be stored as base64 data URLs; putting one in a wa.me link
// makes it far too long for WhatsApp to open, so only short http(s) URLs are shared.
function shareableImageUrl(imageUrl?: string | null) {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl) || imageUrl.length > MAX_IMAGE_URL_LENGTH) return null;
  return imageUrl;
}

export function buildWhatsAppProductLink(phone: string | null | undefined, product: ProductMessageInput) {
  const digits = whatsappDigits(phone);
  if (!digits) return undefined;
  const description = (product.description || "").trim();
  const shortDescription = description.length > MAX_DESCRIPTION_LENGTH ? `${description.slice(0, MAX_DESCRIPTION_LENGTH).trim()}...` : description;
  const imageUrl = shareableImageUrl(product.imageUrl);
  const message = [
    `Hello, I want to buy ${product.title} for GHS ${Number(product.price || 0).toFixed(2)}.`,
    `Details: ${shortDescription || "No description provided"}`,
    `Product page: ${product.productUrl}`,
    imageUrl ? `Product image: ${imageUrl}` : null,
  ].filter(Boolean).join("\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
