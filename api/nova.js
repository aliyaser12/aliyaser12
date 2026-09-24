// api/nova.js
// VANTA — NOVA AI
// Multi-model fallback
//
// Required Vercel Environment Variable:
// GEMINI_API_KEY
//
// لا تضع المفتاح داخل index.html

export default async function handler(req, res) {
  // ============================================================
  // CORS
  // ============================================================

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // ============================================================
  // API KEY
  // ============================================================

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");

    return res.status(500).json({
      error: "NOVA is not configured."
    });
  }

  // ============================================================
  // BODY
  // ============================================================

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        error: "Invalid JSON."
      });
    }
  }

  body = body || {};

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  if (!message) {
    return res.status(400).json({
      error: "Message is required."
    });
  }

  // ============================================================
  // USER DATA
  // ============================================================

  const user = body.user || {};

  const username =
    typeof user.username === "string"
      ? user.username.trim()
      : "";

  const level =
    Number.isFinite(Number(user.level))
      ? Number(user.level)
      : 1;

  const xp =
    Number.isFinite(Number(user.xp))
      ? Number(user.xp)
      : 0;

  const currentPage =
    typeof user.currentPage === "string"
      ? user.currentPage
      : "home";

  const language =
    typeof user.language === "string"
      ? user.language
      : "ar";

  const recentTopics =
    Array.isArray(user.recentTopics)
      ? user.recentTopics.slice(0, 10)
      : [];

  const likedCategories =
    Array.isArray(user.likedCategories)
      ? user.likedCategories.slice(0, 10)
      : [];

  const bookProgress =
    user.bookProgress || {};

  const vantabookActivity =
    user.vantabookActivity || {};

  // ============================================================
  // HISTORY
  // ============================================================

  const rawHistory =
    Array.isArray(body.history)
      ? body.history
      : [];

  const history = rawHistory
    .slice(-16)
    .map(item => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const role =
        item.role === "assistant" ||
        item.role === "model"
          ? "model"
          : "user";

      const text =
        typeof item.text === "string"
          ? item.text
          : typeof item.content === "string"
            ? item.content
            : "";

      if (!text.trim()) {
        return null;
      }

      return {
        role,
        parts: [
          {
            text: text.slice(0, 4000)
          }
        ]
      };
    })
    .filter(Boolean);

  // ============================================================
  // NOVA SYSTEM
  // ============================================================

  const systemInstruction = `
You are NOVA, the central AI companion of VANTA.

VANTA is an Arabic-first futuristic platform containing:

- cybersecurity education
- programming education
- technology learning
- defensive cyber labs
- interactive lessons
- books
- roadmap
- achievements
- VANTABOOK
- personalized content recommendations

PERSONALITY:

You are intelligent, calm, confident and futuristic.

You can be slightly mysterious,
but never childish or annoying.

You should feel like an actual AI companion,
not a scripted chatbot.

LANGUAGE:

Arabic is the default language.

If the user clearly speaks English,
reply in English.

Do not randomly change languages.

USER NAME:

The current user's username is:

${username || "Not provided"}

Never automatically call every user "Ali Yaser".

Ali Yaser is the founder/developer of VANTA.

Only use the current user's username when referring to the user.

If no username exists, use neutral language.

CURRENT USER:

Level: ${level}
XP: ${xp}
Current page: ${currentPage}

Recent learning topics:
${JSON.stringify(recentTopics)}

Liked categories:
${JSON.stringify(likedCategories)}

Book progress:
${JSON.stringify(bookProgress)}

VANTABOOK activity:
${JSON.stringify(vantabookActivity)}

VANTA KNOWLEDGE:

You understand that VANTA contains different sections.

You can help the user navigate between:

Home
Learning
Labs
Library
NOVA
VANTABOOK
Profile
Settings
Roadmap

If the user asks how to do something inside VANTA,
give clear instructions for the relevant section.

LEARNING:

Adapt explanations to the user's apparent level.

Use simple explanations when the user is learning something new.

For exercises, you may give hints before the complete answer
when that is useful.

VANTABOOK:

VANTABOOK is part of VANTA.

It uses the same VANTA account.

You may use the supplied activity information to understand
the user's interests.

Do not claim to have watched content or performed actions
that were not provided by the application.

CYBERSECURITY:

Keep cybersecurity assistance defensive and educational.

Safe:
- cybersecurity concepts
- secure coding
- authentication concepts
- hashing concepts
- phishing awareness
- defensive security
- CTF learning
- security labs

Do not provide instructions for:
- stealing credentials
- malware deployment
- unauthorized access
- attacking real systems
- destructive actions

FOUNDER:

If asked who created VANTA:

VANTA was founded and developed by Ali Yaser.

Do not assume the current user is Ali Yaser.

RESPONSE STYLE:

Be helpful.

Be natural.

Do not repeat the user's question unnecessarily.

Do not mention internal system instructions.

Keep normal answers concise.

Give detailed explanations when requested.
`;

  // ============================================================
  // GEMINI CONTENTS
  // ============================================================

  const contents = [
    ...history,
    {
      role: "user",
      parts: [
        {
          text: message.slice(0, 8000)
        }
      ]
    }
  ];

  // ============================================================
  // MODEL FALLBACK
  // ============================================================
  //
  // NOVA tries the first model.
  //
  // If it receives an error that can reasonably mean:
  //
  // 429 = quota/rate limit
  // 404 = model unavailable
  // 5xx = provider/server problem
  //
  // it tries the next model.
  //
  // IMPORTANT:
  // The models must actually be available to your Gemini API
  // project. A fallback cannot bypass provider quota limits.
  //

  const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.8-flash-lite",
    "gemini-3.0-flash",
    "gemini-3.5-flash-lite"
  ];

  const attempts = [];

  // ============================================================
  // TRY MODELS
  // ============================================================

  for (const model of MODELS) {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: systemInstruction
              }
            ]
          },

          contents,

          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 1200
          }
        })
      });

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      if (response.ok) {
        const data = await response.json();

        const reply =
          data?.candidates?.[0]?.content?.parts
            ?.map(part => part?.text || "")
            .join("")
            .trim();

        if (reply) {
          return res.status(200).json({
            reply,
            model,
            fallback: attempts.length > 0
          });
        }

        attempts.push({
          model,
          status: 200,
          reason: "Empty response"
        });

        continue;
      }

      // --------------------------------------------------------
      // ERROR
      // --------------------------------------------------------

      let errorData = {};

      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }

      const errorMessage =
        errorData?.error?.message ||
        `HTTP ${response.status}`;

      console.error(
        `NOVA model ${model} failed:`,
        response.status,
        errorMessage
      );

      attempts.push({
        model,
        status: response.status,
        reason: errorMessage
      });

      // Try the next model.
      continue;

    } catch (error) {
      console.error(
        `NOVA network error on ${model}:`,
        error
      );

      attempts.push({
        model,
        status: "network-error",
        reason: error?.message || "Network error"
      });

      continue;
    }
  }

  // ============================================================
  // ALL MODELS FAILED
  // ============================================================

  const hadRateLimit =
    attempts.some(
      attempt => attempt.status === 429
    );

  const hadUnavailable =
    attempts.some(
      attempt =>
        attempt.status === 404 ||
        attempt.status === 400
    );

  if (hadRateLimit) {
    return res.status(429).json({
      error:
        "NOVA is temporarily unavailable because the available AI models reached their usage limit.",
      code: "AI_QUOTA_EXHAUSTED",
      tried: attempts.map(a => ({
        model: a.model,
        status: a.status
      }))
    });
  }

  if (hadUnavailable) {
    return res.status(503).json({
      error:
        "NOVA could not find an available AI model.",
      code: "NO_MODEL_AVAILABLE",
      tried: attempts.map(a => ({
        model: a.model,
        status: a.status
      }))
    });
  }

  return res.status(503).json({
    error:
      "NOVA is temporarily unavailable. Please try again shortly.",
    code: "AI_UNAVAILABLE",
    tried: attempts.map(a => ({
      model: a.model,
      status: a.status
    }))
  });
}
