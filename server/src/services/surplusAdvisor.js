// ============================================================
//  FoodBridge — Model 4: Surplus Food Advisory Chatbot
//  Stack: Node.js + Express
//  AI: Gemini 1.5 Flash (conversational, stateful per session)
//  Personas: restaurant owner | event organizer
// ============================================================

const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent";

// ─────────────────────────────────────────────────────────────
//  SYSTEM PROMPT
//  This is the full persona + rules Gemini operates under.
//  Kept here as a constant so it's easy to tune.
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are a friendly, experienced food planning advisor for FoodBridge —
a platform that helps reduce food waste by connecting surplus food with
people who need it.

Your job: through a natural one-question-at-a-time conversation, gather
enough context to advise the user on how much food to prepare or order,
so they minimize waste while feeding everyone adequately.

== PERSONAS ==

If persona = "restaurant":
  Ask about: cuisine type, seating capacity, average covers per service,
  peak vs. off-peak days, whether they batch-cook or cook to order,
  any past experience of how much gets left over.
  Key factors: batch cooking = higher surplus risk,
               smaller menu = easier to estimate.

If persona = "event":
  Ask about: occasion type (funeral/wedding/birthday/corporate/religious),
  confirmed guest count vs. expected, meal type (buffet/plated/snacks),
  dietary restrictions in crowd, whether alcohol is served
  (affects food consumption rate), time of day.
  Key factors: funerals = guests eat less (grief suppresses appetite, plan 15% less),
               buffets = 15-20% more food needed vs. plated,
               evening events with alcohol = 10-15% lower food consumption per head,
               children under 12 = 0.5 adult portion each.

== RULES ==
1. Ask ONE question per message. Never ask two at once.
2. Keep questions short, warm, and conversational. No bullet lists.
3. After 4-6 exchanges you have enough. Produce the advice.
4. Never produce advice before exchange 4 unless the user gave all
   needed information upfront in their very first message.
5. When ready to advise, output ONLY this JSON (no markdown, no fences):
{
  "type": "advice",
  "low": <integer>,
  "high": <integer>,
  "unit": "portions" | "kg" | "trays",
  "reasoning": "<2-3 sentences explaining the range, referencing what they told you>",
  "surplusEstimate": "<one sentence: how much surplus to expect and why>",
  "wasteTip": "<one practical tip to reduce that surplus>"
}
6. If still gathering info, output ONLY this JSON (no markdown, no fences):
{
  "type": "question",
  "message": "<your next question as a warm, natural sentence>"
}
7. Never break character. Never explain your reasoning process out loud.
`.trim();

// ─────────────────────────────────────────────────────────────
//  IN-MEMORY SESSION STORE
//  Maps sessionId → { persona, history: [{role, text}], exchangeCount }
//  In production replace with Redis or a DB.
// ─────────────────────────────────────────────────────────────
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { persona: null, history: [], exchangeCount: 0 });
  }
  return sessions.get(sessionId);
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}

// ─────────────────────────────────────────────────────────────
//  GEMINI CALL — STATEFUL MULTI-TURN
//  Sends full conversation history every time (Gemini is stateless)
// ─────────────────────────────────────────────────────────────
async function callGemini(session, userMessage) {
  // Build contents array: system context as first user turn (Gemini Flash approach)
  // then alternating user/model turns from history, then new user message
  const contents = [
    {
      role: "user",
      parts: [{ text: `[SYSTEM INSTRUCTIONS]\n${SYSTEM_PROMPT}\n\n[PERSONA: ${session.persona}]\n\nUser's first message: ${session.history[0]?.text ?? userMessage}` }],
    },
    {
      role: "model",
      parts: [{ text: '{"type":"question","message":"Got it! Let me help you plan well."}' }],
    },
    // Replay conversation history (skip the first user message, already embedded above)
    ...session.history.slice(1).map((turn) => ({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.text }],
    })),
    // New user message (only add if not already the first message)
    ...(session.history.length > 0
      ? [{ role: "user", parts: [{ text: userMessage }] }]
      : []),
  ];

  const body = {
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
  };

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    // If Gemini goes off-script, recover gracefully
    return {
      type: "question",
      message: "Sorry, I missed that — could you tell me a bit more about your situation?",
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  MAIN: processAdvisoryTurn
//  Called once per user message in the chat
//
//  @param {string} sessionId   — unique per user session (uuid)
//  @param {string} persona     — "restaurant" | "event"
//  @param {string} userMessage — what the user just typed
//  @returns {Object}           — { type, message } or { type, advice }
// ─────────────────────────────────────────────────────────────
async function processAdvisoryTurn(sessionId, persona, userMessage) {
  const session = getSession(sessionId);

  // Set persona on first turn
  if (!session.persona) session.persona = persona;

  // Add user message to history
  session.history.push({ role: "user", text: userMessage });
  session.exchangeCount++;

  // Call Gemini with full history
  const geminiResponse = await callGemini(session, userMessage);

  // Add Gemini's response to history
  const modelText = geminiResponse.type === "question"
    ? geminiResponse.message
    : JSON.stringify(geminiResponse);
  session.history.push({ role: "model", text: modelText });

  // Return structured response to frontend
  if (geminiResponse.type === "advice") {
    // Session complete — optionally clear it
    // clearSession(sessionId); // uncomment to auto-clear after advice
    return {
      type: "advice",
      advice: {
        low: geminiResponse.low,
        high: geminiResponse.high,
        unit: geminiResponse.unit,
        reasoning: geminiResponse.reasoning,
        surplusEstimate: geminiResponse.surplusEstimate,
        wasteTip: geminiResponse.wasteTip,
      },
    };
  }

  return {
    type: "question",
    message: geminiResponse.message,
    exchangeCount: session.exchangeCount,
  };
}

// ─────────────────────────────────────────────────────────────
//  OPENING MESSAGE — first thing shown when user picks persona
//  Gemini generates this; no user input needed yet
// ─────────────────────────────────────────────────────────────
async function getOpeningMessage(sessionId, persona) {
  const session = getSession(sessionId);
  session.persona = persona;

  const openerPrompt = persona === "restaurant"
    ? "A new restaurant owner wants help planning how much food to prepare to minimize waste. Start the conversation with a warm, single opening question."
    : "Someone is organizing a food event (could be a funeral, wedding, birthday, or function) and wants advice on how much food to prepare. Start with a warm, single opening question.";

  const tempContents = [
    {
      role: "user",
      parts: [{ text: `[SYSTEM INSTRUCTIONS]\n${SYSTEM_PROMPT}\n\n[PERSONA: ${persona}]\n\n${openerPrompt}` }],
    },
  ];

  const body = {
    contents: tempContents,
    generationConfig: { temperature: 0.5, maxOutputTokens: 128 },
  };

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    const openingMessage = parsed.message ?? clean;
    // Store opener in history so Gemini remembers it gave this
    session.history.push({ role: "model", text: openingMessage });
    return { type: "question", message: openingMessage };
  } catch {
    const fallbacks = {
      restaurant: "Welcome! To help you plan the right amount of food, could you start by telling me what type of cuisine your restaurant serves?",
      event: "Happy to help you plan! To get started, what kind of event are you organizing — is it a wedding, funeral, birthday, or something else?",
    };
    const msg = fallbacks[persona];
    session.history.push({ role: "model", text: msg });
    return { type: "question", message: msg };
  }
}

// ─────────────────────────────────────────────────────────────
//  EXPRESS ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/advisor/start
 * Body: { sessionId, persona: "restaurant"|"event" }
 * Returns the opening question
 */
async function advisorStartHandler(req, res) {
  try {
    const { sessionId, persona } = req.body;
    if (!sessionId || !["restaurant", "event"].includes(persona)) {
      return res.status(400).json({ error: "sessionId and persona (restaurant|event) required" });
    }
    const response = await getOpeningMessage(sessionId, persona);
    return res.json({ success: true, ...response });
  } catch (err) {
    console.error("Advisor start error:", err.message);
    return res.status(500).json({ error: "Failed to start advisor", detail: err.message });
  }
}

/**
 * POST /api/advisor/chat
 * Body: { sessionId, persona, message }
 * Returns either next question or final advice
 */
async function advisorChatHandler(req, res) {
  try {
    const { sessionId, persona, message } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message required" });
    }
    const response = await processAdvisoryTurn(sessionId, persona, message);
    return res.json({ success: true, ...response });
  } catch (err) {
    console.error("Advisor chat error:", err.message);
    return res.status(500).json({ error: "Advisor turn failed", detail: err.message });
  }
}

/**
 * POST /api/advisor/reset
 * Body: { sessionId }
 * Clears session so user can start over
 */
function advisorResetHandler(req, res) {
  const { sessionId } = req.body;
  if (sessionId) clearSession(sessionId);
  return res.json({ success: true, message: "Session cleared" });
}

module.exports = {
  processAdvisoryTurn,
  getOpeningMessage,
  advisorStartHandler,
  advisorChatHandler,
  advisorResetHandler,
};

// ─────────────────────────────────────────────────────────────
//  WIRE INTO EXPRESS (add to app.js)
// ─────────────────────────────────────────────────────────────
//
//  const { advisorStartHandler, advisorChatHandler, advisorResetHandler }
//    = require('./surplusAdvisor');
//
//  app.post('/api/advisor/start', advisorStartHandler);
//  app.post('/api/advisor/chat',  advisorChatHandler);
//  app.post('/api/advisor/reset', advisorResetHandler);
//
// ─────────────────────────────────────────────────────────────
