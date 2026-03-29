// ============================================================
//  FoodBridge — Model 3: Food Safety NLP Scorer
//  Stack: Node.js  |  AI: Gemini API
//  Runs: (1) on donor form submit  (2) silently at match time
// ============================================================

import fs from 'fs'; // dummy placeholder to shift space
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent";

// ─────────────────────────────────────────────────────────────
//  RISK TIER LOOKUP  (deterministic pre-check before Gemini)
//  Avoids wasting an API call on obviously low-risk items
// ─────────────────────────────────────────────────────────────
const HIGH_RISK_CATEGORIES = new Set([
  "cooked_meal",
  "meat",
  "poultry",
  "seafood",
  "dairy",
  "eggs",
  "cooked_rice",
  "cooked_pasta",
]);

const LOW_RISK_CATEGORIES = new Set([
  "packaged_dry",
  "whole_fruit",
  "whole_vegetable",
  "bread",
  "canned_goods",
  "sealed_packaged",
]);

// Red-flag words that instantly raise concern regardless of category
const RED_FLAG_KEYWORDS = [
  "smell", "smells", "sour", "discolor", "discoloured", "discolored",
  "mold", "mould", "left out", "forgot", "forgotten", "unsure",
  "not sure", "strange", "weird", "off", "stale", "expired",
];

function detectRedFlags(description) {
  const lower = description.toLowerCase();
  return RED_FLAG_KEYWORDS.filter((kw) => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────
//  DETERMINISTIC PRE-SCORER
//  Catches clear-cut cases before calling Gemini
//  Returns null if case is ambiguous (needs Gemini)
// ─────────────────────────────────────────────────────────────
function deterministicPreScore(input) {
  const { foodCategory, storageMethod, hoursSinceCooked, description } = input;

  const redFlags = detectRedFlags(description);
  if (redFlags.length >= 2) {
    return {
      verdict: "Unsafe",
      safetyScore: 0.1,
      riskTier: HIGH_RISK_CATEGORIES.has(foodCategory) ? "high_risk" : "low_risk",
      reason: "Multiple safety red flags found in description.",
      suggestedAction: null,
      redFlags,
      source: "deterministic",
    };
  }

  // High-risk + room temp + > 2 hours → always Unsafe
  if (
    HIGH_RISK_CATEGORIES.has(foodCategory) &&
    storageMethod === "room_temp" &&
    hoursSinceCooked > 2
  ) {
    return {
      verdict: "Unsafe",
      safetyScore: 0.05,
      riskTier: "high_risk",
      reason: "High-risk food left at room temperature over 2 hours.",
      suggestedAction: null,
      redFlags,
      source: "deterministic",
    };
  }

  // Low-risk + sealed/packaged → always Safe (skip Gemini)
  if (LOW_RISK_CATEGORIES.has(foodCategory) && redFlags.length === 0) {
    return {
      verdict: "Safe",
      safetyScore: 0.95,
      riskTier: "low_risk",
      reason: "Low-risk packaged or whole food, no concerns.",
      suggestedAction: null,
      redFlags: [],
      source: "deterministic",
    };
  }

  return null; // needs Gemini
}

// ─────────────────────────────────────────────────────────────
//  GEMINI SAFETY SCORER
// ─────────────────────────────────────────────────────────────
async function geminiSafetyScore(input) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined' || GEMINI_API_KEY === 'your_google_gemini_api_key_here') {
    throw new Error('Valid Gemini API Key not configured');
  }

  const {
    description,
    foodCategory,
    cookedOrRaw,
    hoursSinceCooked,
    storageMethod,
  } = input;

  const prompt = `
You are a food safety expert for a food redistribution platform.
Analyze the food listing below and produce a safety assessment.

--- FOOD LISTING ---
Description (donor's words): "${description}"
Food category: "${foodCategory}"
Cooked or raw: "${cookedOrRaw}"
Time since cooking/preparation: ${hoursSinceCooked} hours
Storage method: "${storageMethod}"

--- YOUR TASK ---
Step 1 — Classify risk tier:
  "high_risk" if: meat, poultry, seafood, dairy, cooked rice/pasta, eggs, cooked meals
  "low_risk"  if: dry goods, packaged sealed food, whole fruits/vegetables, bread

Step 2 — Apply time-temperature rules:
  High-risk food at room temp > 2 hours  → Unsafe
  High-risk food in fridge > 96 hours    → Unsafe
  High-risk food in fridge 24–96 hours   → Caution
  High-risk food in fridge < 24 hours    → Safe
  Low-risk food: use judgment, be lenient

Step 3 — Check description for red-flag words:
  smell, sour, discolored, mold, left out, forgot, unsure, strange, off
  If found: escalate verdict by one level (Safe→Caution or Caution→Unsafe)

Step 4 — Output ONLY valid JSON (no markdown fences, no extra text):
{
  "verdict": "Safe" | "Caution" | "Unsafe",
  "safetyScore": <float 0.0 to 1.0>,
  "riskTier": "high_risk" | "low_risk",
  "reason": "<one sentence, max 12 words>",
  "suggestedAction": "<one actionable instruction for recipient, max 12 words, or null if Safe>",
  "redFlags": ["<flag1>"]
}

safetyScore: Safe=0.75–1.0, Caution=0.35–0.74, Unsafe=0.0–0.34
`.trim();

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
  };

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} — ${await res.text()}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  parsed.source = "gemini";
  return parsed;
}

// ─────────────────────────────────────────────────────────────
//  MAIN: scoreFoodSafety
//  Runs deterministic check first, falls back to Gemini
//
//  @param {Object} input
//    - description      {string}  donor's free-text
//    - foodCategory     {string}  from dropdown
//    - cookedOrRaw      {string}  "cooked" | "raw"
//    - hoursSinceCooked {number}  hours since prep
//    - storageMethod    {string}  "fridge"|"freezer"|"room_temp"|"not_stated"
//    - photoBase64      {string?} optional, for future vision extension
//
//  @returns {Object} safetyResult
//    - verdict          "Safe" | "Caution" | "Unsafe"
//    - safetyScore      float 0.0–1.0  (fed into Model 1)
//    - riskTier         "high_risk" | "low_risk"
//    - reason           one-line explanation
//    - suggestedAction  what recipient should do (null if Safe)
//    - redFlags         array of detected concern words
//    - source           "deterministic" | "gemini" | "fallback"
// ─────────────────────────────────────────────────────────────
async function scoreFoodSafety(input) {
  // Validate required fields
  const required = ["description", "foodCategory", "cookedOrRaw", "hoursSinceCooked", "storageMethod"];
  for (const field of required) {
    if (input[field] === undefined || input[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Step 1: Try deterministic pre-scorer (fast, no API cost)
  const preResult = deterministicPreScore(input);
  if (preResult) return preResult;

  // Step 2: Gemini for ambiguous cases
  try {
    return await geminiSafetyScore(input);
  } catch (err) {
    console.error("⚠️ AI Safey Scorer Offline:", err.message, "— Using fallback.");

    // Graceful fallback — never let the scorer crash the listing flow
    // Default to Caution so recipient is warned but donor isn't blocked
    return {
      verdict: "Caution",
      safetyScore: 0.4,
      riskTier: HIGH_RISK_CATEGORIES.has(input.foodCategory) ? "high_risk" : "low_risk",
      reason: "Safety check unavailable. Treat with caution.",
      suggestedAction: "Inspect food carefully before consuming.",
      redFlags: detectRedFlags(input.description),
      source: "fallback",
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  BADGE FORMATTER  (for frontend display)
//  Converts raw result into UI-ready badge object
// ─────────────────────────────────────────────────────────────
function formatBadge(safetyResult) {
  const { verdict, reason, suggestedAction, redFlags, riskTier } = safetyResult;

  const badgeConfig = {
    Safe:    { color: "green",  label: "Safe to share",   icon: "check"    },
    Caution: { color: "amber",  label: "Use caution",     icon: "warning"  },
    Unsafe:  { color: "red",    label: "Cannot be listed", icon: "block"   },
  };

  return {
    ...badgeConfig[verdict],
    verdict,
    reason,
    suggestedAction,
    redFlags,
    riskTier,
    blocked: verdict === "Unsafe",
  };
}

// ─────────────────────────────────────────────────────────────
//  EXPRESS ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/safety-check
 * Called when donor submits the listing form.
 * Returns badge data + blocks if Unsafe.
 */
async function safetyCheckOnSubmit(req, res) {
  try {
    const input = req.body;
    const result = await scoreFoodSafety(input);
    const badge = formatBadge(result);

    if (badge.blocked) {
      return res.status(200).json({
        success: false,
        blocked: true,
        badge,
        message: "This listing cannot be posted due to food safety concerns.",
      });
    }

    return res.status(200).json({
      success: true,
      blocked: false,
      badge,
      safetyScore: result.safetyScore, // passed to DB with listing
    });
  } catch (err) {
    console.error("Safety check error:", err);
    return res.status(500).json({ error: "Safety check failed", detail: err.message });
  }
}

/**
 * Internal function — called by Model 1 at match time (not an HTTP route)
 * Returns just safetyScore for ranking injection
 */
async function getSafetyScoreForMatch(listingInput) {
  const result = await scoreFoodSafety(listingInput);
  return result.safetyScore;
}

export {
  scoreFoodSafety,
  formatBadge,
  safetyCheckOnSubmit,
  getSafetyScoreForMatch,
};
