const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Server formula: recipient_price x recipients x pages + page_price x pages. */
export function calculateSmsTotal(recipientPrice: number, pagePrice: number, recipients: number, pages: number) {
  const safePages = Math.max(1, pages);
  return round2(recipientPrice * recipients * safePages + pagePrice * safePages);
}

const money = (value: number) => `GH₵${value.toFixed(2)}`;

export function smsCostBreakdown(recipientPrice: number, pagePrice: number, recipients: number, pages: number) {
  const safePages = Math.max(1, pages);
  const total = calculateSmsTotal(recipientPrice, pagePrice, recipients, safePages);
  return `${recipients} recipients × ${safePages} pages × ${money(recipientPrice)} + ${safePages} pages × ${money(pagePrice)} = ${money(total)}`;
}
