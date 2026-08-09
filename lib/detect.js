// Detect step: fetch a vendor's spec/changelog, diff it against the last
// snapshot, and (only if it changed) make ONE Gemini call to classify the
// diff. Then match affected symbols against a repo's usage index.
//
// vendorChange is global: one classification is reused for every repo whose
// usage index contains the affected symbols (see lib/store.js).

import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-flash-latest";

const CLASSIFY_SYSTEM_INSTRUCTION = `You are Driftwatch's vendor change classifier. You are given a diff of new/changed lines from a third-party API changelog or spec. Decide whether it is a breaking change for API callers.

Respond with ONLY a JSON object. No prose, no markdown fences, no explanation outside the JSON. Shape:
{
  "breaking": boolean,
  "severity": "low" | "medium" | "high",
  "summary": "one plain-English sentence",
  "affectedSymbols": ["stripe.paymentIntents.create", "/v1/charges"],
  "migration": "what callers must change, or empty string if not breaking",
  "sourceLine": "the exact line from the changelog this came from",
  "deadline": "YYYY-MM-DD or null"
}`;

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

export async function fetchVendorSpec(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch vendor spec (${res.status}): ${url}`);
  return res.text();
}

// Naive diff: lines present in `next` that were not present in `previous`.
// Good enough for changelog-style text where new entries are appended.
export function diffLines(previous, next) {
  if (previous === next) return null;
  const previousLines = new Set((previous || "").split("\n"));
  const changed = next.split("\n").filter((line) => line.trim() && !previousLines.has(line));
  return changed.length ? changed.join("\n") : null;
}

function parseJsonResponse(text) {
  const cleaned = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Gemini returned invalid JSON (${err.message}). Raw response: ${cleaned.slice(0, 300)}`);
  }
}

// One Gemini call: classify a changelog diff for one vendor.
export async function classifyChange(vendorName, diffText) {
  const model = getModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: `Vendor: ${vendorName}\n\nChangelog diff:\n${diffText}` }] }],
    systemInstruction: CLASSIFY_SYSTEM_INSTRUCTION,
    generationConfig: { responseMimeType: "application/json" },
  });
  return parseJsonResponse(result.response.text());
}

function normalizeSymbol(symbol) {
  return symbol.toLowerCase().replace(/[\s(]+$/, "").trim();
}

// Intersect affectedSymbols against a repo's usage index. Empty result means
// "detected, not applicable to this repo" — stop here, no PR, no noise.
export function matchAffectedCallSites(affectedSymbols, integrations) {
  const normalizedAffected = (affectedSymbols || []).map(normalizeSymbol).filter(Boolean);
  if (!normalizedAffected.length) return [];

  const matches = [];
  for (const integration of integrations || []) {
    for (const site of integration.callSites || []) {
      const normalizedSite = normalizeSymbol(site.symbol);
      const isMatch = normalizedAffected.some(
        (symbol) => normalizedSite.includes(symbol) || symbol.includes(normalizedSite)
      );
      if (isMatch) matches.push(site);
    }
  }
  return matches;
}

// Full detect step for one vendor. Returns { changed: false } and makes
// zero Gemini calls if the spec text is identical to the last snapshot.
export async function detectVendorChange(vendor, previousSnapshot) {
  if (!vendor.specUrl) throw new Error(`No specUrl configured for vendor ${vendor.name}`);

  const rawText = await fetchVendorSpec(vendor.specUrl);
  const diff = diffLines(previousSnapshot, rawText);
  if (!diff) {
    return { changed: false, rawText };
  }

  const classification = await classifyChange(vendor.name, diff);
  return { changed: true, rawText, sourceUrl: vendor.specUrl, ...classification };
}
