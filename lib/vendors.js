// Registry of third-party vendors Driftwatch watches for API usage.
// Adding a vendor is just adding one object here.

export const VENDORS = [
  {
    name: "Stripe",
    patterns: [/stripe\.(\w+)\.(\w+)\s*\(/g, /api\.stripe\.com\/v1\/([\w/]+)/g],
    fieldPatterns: [/\b(amount_captured|payment_intent|charges)\b/g],
    specUrl: process.env.VENDOR_SPEC_URL,
    packageHints: ["stripe"],
  },
  {
    name: "Twilio",
    patterns: [/client\.(messages|calls)\.\w+\s*\(/g, /api\.twilio\.com\/[\w/.]+/g],
    packageHints: ["twilio"],
  },
];
