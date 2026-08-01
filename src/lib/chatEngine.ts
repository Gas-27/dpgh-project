/**
 * chatEngine.ts
 * Self-contained in-browser chat engine.
 * Uses the CHATBOT_KNOWLEDGE_BASE + scored BM25-style matcher.
 * No API key, no fetch — works in dev and production alike.
 *
 * When the Supabase Edge Function is live, swap callLocalEngine()
 * in ChatBot.tsx for a fetch('/api/chat', ...) call.
 */

import { CHATBOT_KNOWLEDGE_BASE, SYNONYMS, type KnowledgeEntry } from "@/data/chatbot-knowledge-base";

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  let t = text.toLowerCase().trim().replace(/[^\w\s*#]/g, " ");
  for (const [from, to] of Object.entries(SYNONYMS)) {
    t = t.split(from).join(to);
  }
  return t;
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// ---------------------------------------------------------------------------
// Stopwords — low-value tokens that should not drive scoring
// ---------------------------------------------------------------------------

const STOP = new Set([
  "i", "me", "my", "we", "our", "you", "your", "it", "its",
  "do", "did", "does", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "will", "would", "can", "could", "should", "may",
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "up", "about", "into", "through", "this",
  "that", "these", "those", "what", "how", "when", "where", "which", "who",
  "why", "not", "no", "so", "than", "there", "their", "they", "them",
  "want", "need", "get", "got", "go", "please", "just", "also", "like",
]);

function meaningful(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP.has(t) && t.length > 1);
}

// ---------------------------------------------------------------------------
// BM25-lite scorer
// ---------------------------------------------------------------------------

const K1 = 1.5;
const B  = 0.75;

function avgDocLen(): number {
  const total = CHATBOT_KNOWLEDGE_BASE.reduce(
    (sum, e) => sum + e.questions.join(" ").split(/\s+/).length,
    0
  );
  return total / CHATBOT_KNOWLEDGE_BASE.length;
}

const AVG_DOC_LEN = avgDocLen();
const N = CHATBOT_KNOWLEDGE_BASE.length;

function idf(term: string): number {
  const df = CHATBOT_KNOWLEDGE_BASE.filter((e) =>
    e.questions.some((q) => normalize(q).includes(term))
  ).length;
  return Math.log((N - df + 0.5) / (df + 0.5) + 1);
}

function scoreEntry(entry: KnowledgeEntry, queryTokens: string[]): number {
  const docText = normalize(entry.questions.join(" ") + " " + entry.category);
  const docTokens = docText.split(/\s+/);
  const docLen = docTokens.length;

  let score = 0;
  for (const term of queryTokens) {
    const tf = docTokens.filter((t) => t === term).length;
    if (tf === 0) continue;
    const idfVal = idf(term);
    const tfAdj = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (docLen / AVG_DOC_LEN)));
    score += idfVal * tfAdj;
  }

  // Bonus: exact phrase match anywhere in questions
  const rawLower = queryTokens.join(" ");
  if (entry.questions.some((q) => normalize(q).includes(rawLower))) {
    score += 4;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Find best matching entry
// ---------------------------------------------------------------------------

function findBestEntry(userText: string): { entry: KnowledgeEntry | null; score: number } {
  const allTokens = tokenize(userText);
  const tokens    = meaningful(allTokens);

  if (tokens.length === 0 && allTokens.length === 0) {
    return { entry: null, score: 0 };
  }

  const searchTokens = tokens.length > 0 ? tokens : allTokens;

  let best: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    const s = scoreEntry(entry, searchTokens);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }

  return { entry: best, score: bestScore };
}

// ---------------------------------------------------------------------------
// Related entries lookup
// ---------------------------------------------------------------------------

function getRelated(entry: KnowledgeEntry): KnowledgeEntry[] {
  if (!entry.relatedIds?.length) return [];
  return entry.relatedIds
    .map((id) => CHATBOT_KNOWLEDGE_BASE.find((e) => e.id === id))
    .filter(Boolean) as KnowledgeEntry[];
}

// ---------------------------------------------------------------------------
// Conversation context (simple last-intent memory)
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function detectContext(history: ChatMessage[]): string | null {
  // Look back at last 4 messages for follow-up context
  const recent = history.slice(-4);
  for (const m of recent.reverse()) {
    if (m.role === "assistant") {
      if (m.content.includes("phone number")) return "awaiting_phone";
      if (m.content.includes("network")) return "awaiting_network";
      if (m.content.includes("order ID") || m.content.includes("order id")) return "awaiting_order_id";
    }
  }
  return null;
}

function looksLikePhone(text: string): boolean {
  return /^(\+233|0)[2-9][0-9]{8}$/.test(text.replace(/\s+/g, ""));
}

// ---------------------------------------------------------------------------
// Fallback responses
// ---------------------------------------------------------------------------

const FALLBACKS = [
  "I'm not sure I caught that. Could you rephrase? You can ask about **packages**, **buying data**, **agent sign-up**, **AFA**, **refunds**, **withdrawals**, or **order tracking**.",
  "I didn't quite get that. Try asking something like: _'How do I buy data?'_ or _'How do I become an agent?'_",
  "That one's tricky! Could you be more specific? I can help with **orders**, **packages**, **payments**, **AFA bundles**, or anything on the platform.",
];

let fallbackIndex = 0;
function nextFallback(): string {
  return FALLBACKS[fallbackIndex++ % FALLBACKS.length];
}

// ---------------------------------------------------------------------------
// Phone-number follow-up handler
// ---------------------------------------------------------------------------

function handlePhoneFollowUp(phone: string): string {
  return `Got it — I've noted **${phone}**. In production this will pull your order history live from the database. For now, please tap **Track Order** in your dashboard or contact WhatsApp support with this number for the fastest resolution.`;
}

// ---------------------------------------------------------------------------
// Main engine entry point
// ---------------------------------------------------------------------------

export interface EngineResponse {
  reply: string;
  followUp?: "collect_phone" | "collect_network";
  relatedQuestions?: string[];
}

export function callLocalEngine(
  userText: string,
  history: ChatMessage[]
): EngineResponse {
  const trimmed = userText.trim();
  if (!trimmed) {
    return { reply: "Please type a message and I'll be happy to help!" };
  }

  // --- Context-aware follow-up handling ---
  const ctx = detectContext(history);
  if (ctx === "awaiting_phone" && looksLikePhone(trimmed)) {
    return { reply: handlePhoneFollowUp(trimmed) };
  }

  // --- Score against knowledge base ---
  const { entry, score } = findBestEntry(trimmed);

  // Threshold: require at least a modest score to avoid garbage matches
  if (!entry || score < 0.8) {
    return { reply: nextFallback() };
  }

  const related = getRelated(entry);
  const relatedQuestions = related.length > 0
    ? related.flatMap((e) => [e.questions[0]])
    : undefined;

  return {
    reply: entry.answer,
    followUp: entry.followUp,
    relatedQuestions,
  };
}
