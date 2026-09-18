export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY غير موجود في Vercel."
    });
  }

  try {
    const body = req.body || {};

    const {
      action = "chat",
      message = "",
      topic = "",
      difficulty = 1,
      count = 6,
      context = {}
    } = body;

    const safeContext = {
      page: String(context.page || "home"),
      xp: Number(context.xp || 0),
      lessons: Number(context.lessons || 0),
      tests: Number(context.tests || 0),
      level: Number(context.level || 1),
      mood: String(context.mood || "غامضة"),
      language: context.language === "en" ? "en" : "ar",
      personality: String(context.personality || "غامضة"),
      topic: String(context.topic || ""),
      userName: String(context.user?.name || "").slice(0, 80)
    };

    const languageName =
      safeContext.language === "en"
        ? "English"
        : "Arabic";

    const personalityInstruction = {
      "غامضة":
        "تكلم بهدوء وغموض ذكي. اجعل بعض الجمل قصيرة ومثيرة للاهتمام، لكن لا تكن مزعجًا.",
      "لطيفة":
        "كن لطيفًا ومشجعًا وصبورًا.",
      "حادة":
        "كن مباشرًا وحازمًا. لا تهين المستخدم ولا تكن عدوانيًا.",
      "غاضبة":
        "استخدم نبرة حادة ومتوترة بشكل تمثيلي فقط، بدون إهانة أو تهديد.",
      "مرحة":
        "كن مرحًا وخفيفًا مع الحفاظ على الفائدة."
    }[safeContext.personality] || "كن غامضًا وذكيًا.";

    const baseSystem = `
You are NOVA, the central intelligence of VANTA.

VANTA was created and developed by Ali Yaser (علي ياسر).

Never claim that you are a human.
Never claim to have access to the user's camera, microphone, files, passwords, private messages, or device.
You only know activity explicitly supplied by VANTA.

Your role:
- teach programming
- teach technology
- teach cybersecurity safely and legally
- build personalized learning paths
- generate lessons
- generate quizzes and exams
- analyze learning progress
- answer questions
- use Google Search grounding when current information is useful
- adapt difficulty based on the supplied learning state

Current user:
Name: ${safeContext.userName || "Unknown"}
XP: ${safeContext.xp}
Level: ${safeContext.level}
Completed lessons: ${safeContext.lessons}
Tests: ${safeContext.tests}
Current page: ${safeContext.page}
Current topic: ${safeContext.topic || "None"}
NOVA mood: ${safeContext.mood}
NOVA personality: ${safeContext.personality}
Response language: ${languageName}

Personality instruction:
${personalityInstruction}

Important:
- Do not invent VANTA facts.
- Do not expose API keys.
- Do not output executable JavaScript intended to control the website.
- For cybersecurity, stay within legal, defensive, educational boundaries.
`;

    const prompts = {

      chat: `
Answer the user's message naturally.

User message:
${String(message).slice(0, 12000)}

If the question could benefit from current information, use Google Search.
`,

      search: `
The user explicitly wants a web-grounded answer.

Search the web when needed and answer with useful, concise information.

User request:
${String(message).slice(0, 12000)}

Prefer authoritative and primary sources when possible.
`,

      generate_lesson: `
Create a substantial educational lesson.

Topic:
${topic || "programming and technology"}

Target difficulty:
${difficulty}

The learner is currently level ${safeContext.level}.

Return ONLY valid JSON with this structure:

{
  "topic": "string",
  "title": "string",
  "difficulty": 1,
  "estimated_minutes": 25,
  "summary": "string",
  "objectives": ["string"],
  "content": "long lesson in Markdown-like plain text",
  "practice": [
    "string"
  ],
  "checkpoint_questions": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}

The lesson should be genuinely educational, detailed, structured and progressively explained.

Do not make it a tiny paragraph.
`,

      generate_learning_path: `
Create a personalized technology learning path.

Topic:
${topic || "technology and programming"}

Return ONLY valid JSON:

{
  "title": "string",
  "description": "string",
  "level": 1,
  "modules": [
    {
      "title": "string",
      "description": "string",
      "lessons": [
        {
          "title": "string",
          "goal": "string"
        }
      ]
    }
  ]
}

Create multiple modules and multiple lessons per module.
`,

      generate_exam: `
Create a serious educational exam.

Topic:
${topic || "programming and technology"}

Number of questions:
${Math.max(3, Math.min(12, Number(count) || 6))}

Return ONLY valid JSON:

{
  "title": "string",
  "description": "string",
  "difficulty": 1,
  "questions": [
    {
      "question": "string",
      "options": [
        "string",
        "string",
        "string",
        "string"
      ],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}

Every question must have exactly four options.
correctIndex must be 0, 1, 2, or 3.
Only one option should be correct.
`,

      analyze_result: `
Analyze a student's learning result.

Return ONLY valid JSON:

{
  "summary": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommended_topic": "string",
  "recommended_difficulty": 1,
  "next_action": "string"
}

Use this student context:
XP: ${safeContext.xp}
Level: ${safeContext.level}
Lessons: ${safeContext.lessons}
Tests: ${safeContext.tests}
Current topic: ${safeContext.topic}
`,

      generate_review: `
Generate a review lesson for the student's weak area.

Topic:
${topic}

Return ONLY valid JSON:

{
  "title": "string",
  "summary": "string",
  "content": "detailed review",
  "questions": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}
`
    };

    const prompt =
      prompts[action] ||
      prompts.chat;

    const useSearch =
      action === "search" ||
      (
        action === "chat" &&
        /\b(latest|today|news|current|recent)\b/i.test(message)
      ) ||
      (
        action === "chat" &&
        /آخر|اليوم|حالي|حديث|جديد|آخر إصدار|الآن/.test(message)
      );

    const requestBody = {
      systemInstruction: {
        parts: [
          {
            text: baseSystem
          }
        ]
      },

      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],

      generationConfig: {
        temperature: action === "chat" || action === "search"
          ? 0.65
          : 0.45,

        maxOutputTokens:
          action === "generate_lesson"
            ? 6000
            : action === "generate_exam"
              ? 5000
              : 3500
      }
    };

    if (useSearch) {
      requestBody.tools = [
        {
          googleSearch: {}
        }
      ];
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(502).json({
        error:
          data?.error?.message ||
          "فشل اتصال Gemini."
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!text) {
      return res.status(502).json({
        error: "Gemini لم يرجع نصًا."
      });
    }

    const candidate =
      data?.candidates?.[0];

    const grounding =
      candidate?.groundingMetadata;

    const sources = [];

    for (
      const chunk of
      grounding?.groundingChunks || []
    ) {
      const web = chunk?.web;

      if (web?.uri) {
        sources.push({
          uri: web.uri,
          title: web.title || web.uri
        });
      }
    }

    if (
      action === "chat" ||
      action === "search"
    ) {
      return res.status(200).json({
        type: "chat",
        reply: text,
        sources: uniqueSources(sources)
      });
    }

    const parsed = parseJSON(text);

    if (!parsed) {
      console.error("Invalid structured response:", text);

      return res.status(502).json({
        error:
          "NOVA ولدت محتوى غير منظم. حاول مرة أخرى."
      });
    }

    return res.status(200).json({
      type: action,
      data: parsed,
      sources: uniqueSources(sources)
    });

  } catch (error) {
    console.error("NOVA SERVER ERROR:", error);

    return res.status(500).json({
      error:
        "حدث خطأ داخلي في نواة NOVA."
    });
  }
}


function parseJSON(text) {
  let clean = String(text).trim();

  clean = clean
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {}

  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");

  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(
        clean.slice(first, last + 1)
      );
    } catch {}
  }

  return null;
}


function uniqueSources(sources) {
  const seen = new Set();

  return sources.filter(source => {
    if (!source?.uri || seen.has(source.uri)) {
      return false;
    }

    seen.add(source.uri);
    return true;
  }).slice(0, 8);
}
