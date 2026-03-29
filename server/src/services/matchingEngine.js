// ============================================================
//  FoodBridge — Model 1: Smart Donor-Recipient Matching Engine
//  Stack: Node.js  |  AI: Gemini API (batched dietary check)
// ============================================================

const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

// ─────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent";

const MAX_RADIUS_KM = 10;        // hard geo cutoff
const TOP_N = 5;                 // max matches returned

// ─────────────────────────────────────────────────────────────
//  SCORING WEIGHTS (shift based on diet strictness 1–5)
//  Each key is a strictness level, value = weight vector
//  [distance, dietary, quantity, freshness, deliveryPref]
// ─────────────────────────────────────────────────────────────
function getWeights(strictness) {
  // Linearly interpolate between lenient (1) and strict (5)
  const t = (strictness - 1) / 4; // 0.0 → 1.0
  return {
    distance:    lerp(0.30, 0.10, t),
    dietary:     lerp(0.25, 0.50, t),
    quantity:    lerp(0.20, 0.15, t),
    freshness:   lerp(0.15, 0.15, t),
    deliveryPref:lerp(0.10, 0.10, t),
  };
}

function lerp(a, b, t) {
  return +(a + (b - a) * t).toFixed(4);
}

// ─────────────────────────────────────────────────────────────
//  GEO UTILS
// ─────────────────────────────────────────────────────────────

/** Haversine distance in km between two {lat, lng} points */
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const chord =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

/** Distance score: 1.0 at 0 km, 0.0 at MAX_RADIUS_KM */
function scoreDistance(distKm) {
  return Math.max(0, 1 - distKm / MAX_RADIUS_KM);
}

// ─────────────────────────────────────────────────────────────
//  QUANTITY FIT SCORE
//  Perfect fit = 1.0. Donor has less than needed = penalise.
//  Donor has surplus = slight penalty (waste risk).
// ─────────────────────────────────────────────────────────────
function scoreQuantity(donorServings, recipientNeeds) {
  if (donorServings === 0 || recipientNeeds === 0) return 0;
  const ratio = donorServings / recipientNeeds;
  if (ratio >= 0.9 && ratio <= 1.5) return 1.0;      // good fit
  if (ratio < 0.9)  return ratio / 0.9;               // not enough
  if (ratio > 1.5)  return Math.max(0.5, 1.5 / ratio); // surplus
  return 0;
}

// ─────────────────────────────────────────────────────────────
//  FRESHNESS URGENCY SCORE
//  Near-expiry food scores higher — urgency to redistribute
// ─────────────────────────────────────────────────────────────
function scoreFreshness(expiryTimestamp) {
  const now = Date.now();
  const msLeft = expiryTimestamp - now;
  const hoursLeft = msLeft / (1000 * 60 * 60);

  if (hoursLeft <= 0)  return 0;       // expired — should not reach here
  if (hoursLeft <= 1)  return 1.0;     // critically urgent
  if (hoursLeft <= 3)  return 0.85;    // very urgent
  if (hoursLeft <= 6)  return 0.65;    // urgent
  if (hoursLeft <= 12) return 0.45;    // moderate
  if (hoursLeft <= 24) return 0.25;    // comfortable
  return 0.10;                          // far away — low urgency
}

// ─────────────────────────────────────────────────────────────
//  DELIVERY PREFERENCE SCORE
//  donor offers pickup / delivery
//  recipient prefers pickup / delivery
// ─────────────────────────────────────────────────────────────
function scoreDeliveryPref(donorOffer, recipientPref) {
  // donorOffer:    "pickup_only" | "delivery_available" | "both"
  // recipientPref: "pickup"     | "delivery"
  if (donorOffer === "both") return 1.0;
  if (donorOffer === "delivery_available" && recipientPref === "delivery") return 1.0;
  if (donorOffer === "pickup_only" && recipientPref === "pickup") return 1.0;
  if (donorOffer === "pickup_only" && recipientPref === "delivery") return 0.3;
  return 0.5;
}

// ─────────────────────────────────────────────────────────────
//  GEMINI — BATCH DIETARY COMPATIBILITY CHECK
//  One API call for all eligible recipients
// ─────────────────────────────────────────────────────────────
async function checkDietaryCompatibility(donor, recipients) {
  const recipientsPayload = recipients.map((r) => ({
    recipientId: r.id,
    restrictions: r.dietaryRestrictions,   // e.g. ["diabetic", "no pork", "gluten free"]
    strictness: r.dietStrictness,
  }));

  const prompt = `
You are a food safety and dietary compatibility expert for a food redistribution platform.

A donor has posted the following food:
- Description: "${donor.description}"
- Category: "${donor.foodCategory}"
- Type: "${donor.cookedOrRaw}"

For EACH recipient below, classify whether this food is:
  - "safe"    — fully compatible with all their dietary restrictions
  - "partial" — mostly compatible but with one concern (state it in ≤6 words)
  - "unsafe"  — incompatible with one or more restrictions

IMPORTANT:
- If restrictions array is empty, always return "safe"
- Be strict when strictness >= 4 and lenient when strictness <= 2
- Return ONLY a valid JSON array with no explanation, no markdown, no backticks

Format:
[
  { "recipientId": "string", "status": "safe"|"partial"|"unsafe", "reason": "short reason or empty string" }
]

Recipients:
${JSON.stringify(recipientsPayload, null, 2)}
`.trim();

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  };

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned); // [{ recipientId, status, reason }]
}

/** Convert Gemini's status string to a 0–1 numeric score */
function dietaryStatusToScore(status) {
  if (status === "safe")    return 1.0;
  if (status === "partial") return 0.5;
  return 0.0; // "unsafe"
}

// ─────────────────────────────────────────────────────────────
//  MAIN: matchDonorToRecipients
//
//  @param {Object} donor   — the new food listing
//  @param {Array}  allRecipients — all registered recipients from DB
//  @returns {Array} top N ranked matches with score breakdown
// ─────────────────────────────────────────────────────────────
async function matchDonorToRecipients(donor, allRecipients) {
  // ── STEP 1: Hard geo filter ──────────────────────────────
  const nearby = allRecipients.filter((r) => {
    const dist = haversineKm(donor.location, r.location);
    r._distKm = +dist.toFixed(2); // cache for scoring
    return dist <= MAX_RADIUS_KM;
  });

  if (nearby.length === 0) {
    return { matches: [], message: "No recipients within radius" };
  }

  // ── STEP 2: Gemini dietary check (single batched call) ───
  let dietaryResults = [];
  try {
    dietaryResults = await checkDietaryCompatibility(donor, nearby);
  } catch (err) {
    console.error("Gemini call failed, defaulting all to partial:", err.message);
    // Graceful fallback — don't crash the match
    dietaryResults = nearby.map((r) => ({
      recipientId: r.id,
      status: "partial",
      reason: "dietary check unavailable",
    }));
  }

  // Index dietary results by recipientId
  const dietaryMap = {};
  for (const d of dietaryResults) {
    dietaryMap[d.recipientId] = d;
  }

  // ── STEP 3: Score each recipient ────────────────────────
  const scored = nearby.map((r) => {
    const weights = getWeights(r.dietStrictness ?? 3);
    const dietary = dietaryMap[r.id] ?? { status: "partial", reason: "" };

    const s1 = scoreDistance(r._distKm);
    const s2 = dietaryStatusToScore(dietary.status);
    const s3 = scoreQuantity(donor.servings, r.peopleToFeed);
    const s4 = scoreFreshness(donor.expiryTimestamp);
    const s5 = scoreDeliveryPref(donor.deliveryOption, r.preferredDelivery);

    const finalScore =
      weights.distance     * s1 +
      weights.dietary      * s2 +
      weights.quantity     * s3 +
      weights.freshness    * s4 +
      weights.deliveryPref * s5;

    return {
      recipientId:   r.id,
      recipientName: r.name,
      recipientType: r.type, // "individual" | "ngo"
      distanceKm:    r._distKm,
      finalScore:    +finalScore.toFixed(4),
      breakdown: {
        distance:      { score: +s1.toFixed(3), weight: weights.distance },
        dietary:       { score: +s2.toFixed(3), weight: weights.dietary, status: dietary.status, reason: dietary.reason },
        quantity:      { score: +s3.toFixed(3), weight: weights.quantity },
        freshness:     { score: +s4.toFixed(3), weight: weights.freshness },
        deliveryPref:  { score: +s5.toFixed(3), weight: weights.deliveryPref },
      },
      dietaryNote: dietary.reason || null,
    };
  });

  // ── STEP 4: Sort and return top N ───────────────────────
  const ranked = scored
    .filter((r) => r.breakdown.dietary.status !== "unsafe") // hard exclude unsafe
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, TOP_N);

  return { matches: ranked, totalEligible: nearby.length };
}

// ─────────────────────────────────────────────────────────────
//  EXPRESS ROUTE HANDLER  (plug into your Express app)
//
//  POST /api/match
//  Body: { donor, allRecipients }
// ─────────────────────────────────────────────────────────────
async function matchRouteHandler(req, res) {
  try {
    const { donor, allRecipients } = req.body;

    if (!donor || !allRecipients) {
      return res.status(400).json({ error: "donor and allRecipients required" });
    }

    const result = await matchDonorToRecipients(donor, allRecipients);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("Match engine error:", err);
    return res.status(500).json({ error: "Matching failed", detail: err.message });
  }
}

export { matchDonorToRecipients, matchRouteHandler };
