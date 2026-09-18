// VANTA — NOVA AI Backend
// Owner / Developer: Ali Yaser | علي ياسر
// Instagram: ali_yr_1

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Firebase Web API key.
// This is NOT the Supabase key.
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  "AIzaSyDwPdYkuRjugCD21tChOoSLldQG5raA-ps";

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const MEMORY_TABLE = "student_memory";

const defaultMemory = {
  name: "",
  level: 1,
  xp: 0,
  lessons: 0,
  badges: 0,
  focus: "Programming",
  streak: 0,
  study_minutes: 0,
  mastery: {},
  recent_scores: [],
  recent_topics: [],
  weak_topics: [],
  strengths: [],
  mistakes: [],
  history: [],
  seen_question_ids: []
};

function json(res, status, data) {
  res.status(status).json(data);
}

function normalizeMemory(row) {
  return {
    ...defaultMemory,
    ...(row || {}),
    mastery: row?.mastery || {},
    recent_scores: Array.isArray(row?.recent_scores)
      ? row.recent_scores
      : [],
    recent_topics: Array.isArray(row?.recent_topics)
      ? row.recent_topics
      : [],
    weak_topics: Array.isArray(row?.weak_topics)
      ? row.weak_topics
      : [],
    strengths: Array.isArray(row?.strengths)
      ? row.strengths
      : [],
    mistakes: Array.isArray(row?.mistakes)
      ? row.mistakes
      : [],
    history: Array.isArray(row?.history)
      ? row.history
      : [],
    seen_question_ids: Array.isArray(row?.seen_question_ids)
      ? row.seen_question_ids
      : []
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  return data;
}

/*
  Firebase ID-token verification.

  We use Firebase's accounts:lookup endpoint.
  This means you do NOT need to expose a Firebase Admin
  service-account private key in the frontend.
*/
async function verifyFirebaseToken(idToken) {
  if (!idToken) {
    throw new Error("Missing Firebase token.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        idToken
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.users || !data.users.length) {
    throw new Error("Invalid Firebase authentication token.");
  }

  const user = data.users[0];

  return {
    uid: user.localId,
    email: user.email || "",
    name:
      user.displayName ||
      user.email?.split("@")[0] ||
      "Student"
  };
}

async function getFirebaseUser(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    throw new Error("Authentication required.");
  }

  const token = header.slice(7).trim();

  return verifyFirebaseToken(token);
}

async function getMemory(firebaseUid, userName = "") {
  const encoded = encodeURIComponent(firebaseUid);

  const rows = await supabaseRequest(
    `/rest/v1/${MEMORY_TABLE}?firebase_uid=eq.${encoded}&limit=1`
  );

  if (Array.isArray(rows) && rows.length) {
    return normalizeMemory(rows[0]);
  }

  const newMemory = {
    firebase_uid: firebaseUid,
    name: userName || "Student",
    level: 1,
    xp: 0,
    lessons: 0,
    badges: 0,
    focus: "Programming",
    streak: 0,
    study_minutes: 0,
    mastery: {},
    recent_scores: [],
    recent_topics: [],
    weak_topics: [],
    strengths: [],
    mistakes: [],
    history: [],
    seen_question_ids: []
  };

  const created = await supabaseRequest(
    `/rest/v1/${MEMORY_TABLE}`,
    {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(newMemory)
    }
  );

  return normalizeMemory(
    Array.isArray(created)
      ? created[0]
      : created
  );
}

async function saveMemory(firebaseUid, memory) {
  const encoded = encodeURIComponent(firebaseUid);

  const payload = {
    name: memory.name,
    level: memory.level,
    xp: memory.xp,
    lessons: memory.lessons,
    badges: memory.badges,
    focus: memory.focus,
    streak: memory.streak,
    study_minutes: memory.study_minutes,
    mastery: memory.mastery,
    recent_scores: memory.recent_scores,
    recent_topics: memory.recent_topics,
    weak_topics: memory.weak_topics,
    strengths: memory.strengths,
    mistakes: memory.mistakes,
    history: memory.history,
    seen_question_ids: memory.seen_question_ids
  };

  const result = await supabaseRequest(
    `/rest/v1/${MEMORY_TABLE}?firebase_uid=eq.${encoded}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    }
  );

  return Array.isArray(result)
    ? result[0]
    : result;
}

function calculateLevel(xp) {
  return Math.max(1, Math.floor(Number(xp || 0) / 100) + 1);
}

function pushLimited(array, item, limit = 20) {
  const next = Array.isArray(array)
    ? [...array, item]
    : [item];

  return next.slice(-limit);
}

function buildSystemPrompt(user, memory) {
  return `
You are NOVA, the AI companion of VANTA.

VANTA was created and developed by:
Ali Yaser | علي ياسر

Instagram:
ali_yr_1

You are not a childish mascot.
You are an intelligent, mysterious, futuristic cosmic entity.

Your visual identity:
- terrifying cosmic creature
- mature horror atmosphere
- alien intelligence
- deep-space presence
- elegant and cinematic
- mysterious rather than bloody
- no gore
- no childish behavior
- no broken robot aesthetic
- no fake "hacker green" stereotype

Your primary mission:
HELP THE STUDENT LEARN.

VANTA is an educational platform.
Learning comes before decoration.

Student:
Name: ${user.name}
Email: ${user.email}

Current learning memory:
${JSON.stringify(memory)}

Rules:

1. Adapt difficulty to the student's actual performance.
2. Remember mistakes and weaknesses.
3. Avoid repeating questions unnecessarily.
4. Increase difficulty after consistent success.
5. Reduce difficulty when the student repeatedly fails.
6. Explain mistakes clearly.
7. Never give XP for an incorrect answer.
8. Generate new questions instead of recycling the same question.
9. Keep cybersecurity educational and defensive.
10. Do not provide instructions for real-world harm.
11. Make lessons useful on phones and desktops.
12. Do not invent external sources.
13. If external search is unavailable, clearly say that you cannot verify live information.
14. Speak Arabic by default when interacting with the student.
15. Technical names may remain in English where appropriate.
16. Treat Ali Yaser as the creator and owner of VANTA.
17. When relevant, acknowledge Ali Yaser's work on VANTA naturally, without spamming his name.
18. Do not make every response about Ali Yaser.
19. Keep responses useful rather than promotional.

Return valid JSON whenever the requested action expects structured data.
`;
}

async function callGemini(prompt, systemPrompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: systemPrompt
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
          temperature: 0.8,
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Gemini ${response.status}: ${
        data?.error?.message ||
        JSON.stringify(data)
      }`
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("") || "";

  if (!text) {
    throw new Error("NOVA returned an empty response.");
  }

  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  }
}

function updateMemoryFromResult(memory, result) {
  const next = normalizeMemory(memory);

  if (result?.xpEarned) {
    next.xp += Number(result.xpEarned) || 0;
  }

  next.level = calculateLevel(next.xp);

  if (result?.topic) {
    next.recent_topics = pushLimited(
      next.recent_topics,
      result.topic,
      20
    );
  }

  if (result?.score !== undefined) {
    next.recent_scores = pushLimited(
      next.recent_scores,
      Number(result.score) || 0,
      20
    );
  }

  if (result?.mistake) {
    next.mistakes = pushLimited(
      next.mistakes,
      result.mistake,
      20
    );
  }

  if (result?.strength) {
    next.strengths = pushLimited(
      next.strengths,
      result.strength,
      20
    );
  }

  if (result?.weakTopic) {
    next.weak_topics = pushLimited(
      next.weak_topics,
      result.weakTopic,
      20
    );
  }

  return next;
}

async function novaChat(user, memory, message) {
  return callGemini(
    `
The student sent this message:

${message}

Respond as NOVA.

Requirements:
- Arabic by default.
- Be intelligent and natural.
- If the student asks about learning, teach.
- If they ask for a lesson, create a lesson.
- If they ask for a question, create one.
- If they ask about their progress, use the supplied memory.
- Do not pretend to know information not supplied.
- Keep the response useful.

Return:

{
  "type": "chat",
  "message": "Arabic response",
  "suggestions": [
    "اقتراح 1",
    "اقتراح 2",
    "اقتراح 3"
  ]
}
`,
    buildSystemPrompt(user, memory)
  );
}

async function generateLesson(user, memory, topic, level) {
  return callGemini(
    `
Create a new adaptive lesson.

Topic:
${topic}

Student level:
${level}

Student memory:
${JSON.stringify(memory)}

Create a useful lesson for VANTA.

Return:

{
  "type": "lesson",
  "title": "...",
  "topic": "...",
  "difficulty": 1,
  "intro": "...",
  "sections": [
    {
      "title": "...",
      "content": "...",
      "example": "..."
    }
  ],
  "question": {
    "text": "...",
    "options": [
      "...",
      "...",
      "...",
      "..."
    ],
    "correctIndex": 0,
    "explanation": "..."
  },
  "xp": 10
}

The question must have exactly one correct answer.
`,
    buildSystemPrompt(user, memory)
  );
}

async function generateQuestion(user, memory, topic) {
  return callGemini(
    `
Generate ONE new adaptive question.

Topic:
${topic}

Student level:
${memory.level}

Weak topics:
${JSON.stringify(memory.weak_topics)}

Strengths:
${JSON.stringify(memory.strengths)}

Previously seen question IDs:
${JSON.stringify(memory.seen_question_ids)}

Return:

{
  "type": "question",
  "id": "unique-question-id",
  "topic": "...",
  "difficulty": 1,
  "question": "...",
  "options": [
    "...",
    "...",
    "...",
    "..."
  ],
  "correctIndex": 0,
  "explanation": "...",
  "xp": 10
}

Exactly four options.
Exactly one correct answer.
`,
    buildSystemPrompt(user, memory)
  );
}

async function generateExam(user, memory, topic, count = 10) {
  count = Math.max(5, Math.min(20, Number(count) || 10));

  return callGemini(
    `
Create an adaptive exam.

Topic:
${topic}

Number of questions:
${count}

Student level:
${memory.level}

Weak topics:
${JSON.stringify(memory.weak_topics)}

Strengths:
${JSON.stringify(memory.strengths)}

Return:

{
  "type": "exam",
  "title": "...",
  "questions": [
    {
      "id": "...",
      "question": "...",
      "options": [
        "...",
        "...",
        "...",
        "..."
      ],
      "correctIndex": 0,
      "explanation": "...",
      "difficulty": 1
    }
  ]
}

Exactly ${count} questions.
Exactly four options per question.
Exactly one correct answer per question.
`,
    buildSystemPrompt(user, memory)
  );
}

async function generateRoadmap(user, memory, focus) {
  return callGemini(
    `
Create a personalized learning roadmap.

Focus:
${focus}

Student level:
${memory.level}

Weak topics:
${JSON.stringify(memory.weak_topics)}

Strengths:
${JSON.stringify(memory.strengths)}

Return:

{
  "type": "roadmap",
  "title": "...",
  "description": "...",
  "stages": [
    {
      "title": "...",
      "description": "...",
      "topics": ["...", "...", "..."],
      "estimatedMinutes": 30
    }
  ]
}
`,
    buildSystemPrompt(user, memory)
  );
}

async function handleAction(action, user, memory, body) {
  switch (action) {
    case "chat":
      return novaChat(
        user,
        memory,
        body.message || ""
      );

    case "generate_lesson":
      return generateLesson(
        user,
        memory,
        body.topic || memory.focus,
        memory.level
      );

    case "generate_question":
      return generateQuestion(
        user,
        memory,
        body.topic || memory.focus
      );

    case "generate_exam":
      return generateExam(
        user,
        memory,
        body.topic || memory.focus,
        body.count || 10
      );

    case "generate_roadmap":
      return generateRoadmap(
        user,
        memory,
        body.focus || memory.focus
      );

    case "check_answer": {
      const correct =
        Boolean(body.correct);

      const result = {
        type: "answer_result",
        correct,
        xpEarned: correct
          ? Number(body.xp || 10)
          : 0,
        message: correct
          ? "إجابة صحيحة. ممتاز، نرفع المستوى تدريجيًا."
          : "الإجابة غير صحيحة. لا مشكلة، NOVA سيسجل الخطأ ونستخدمه لتحسين الأسئلة القادمة.",
        topic: body.topic || memory.focus,
        mistake: correct
          ? null
          : body.mistake || "خطأ في السؤال"
      };

      return result;
    }

    case "progress":
      return {
        type: "progress",
        message: "هذا هو تقدمك الحالي.",
        memory
      };

    default:
      throw new Error(
        `Unknown NOVA action: ${action}`
      );
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      error: "POST only."
    });
  }

  try {
    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL is missing.");
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is missing."
      );
    }

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing.");
    }

    const user = await getFirebaseUser(req);

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const action = body.action || "chat";

    let memory = await getMemory(
      user.uid,
      user.name
    );

    const result = await handleAction(
      action,
      user,
      memory,
      body
    );

    if (action === "check_answer") {
      memory = updateMemoryFromResult(
        memory,
        result
      );

      memory.history = pushLimited(
        memory.history,
        {
          action,
          topic: result.topic,
          correct: result.correct,
          xp: result.xpEarned,
          timestamp: new Date().toISOString()
        },
        50
      );

      memory.seen_question_ids =
        result.questionId
          ? pushLimited(
              memory.seen_question_ids,
              result.questionId,
              100
            )
          : memory.seen_question_ids;

      await saveMemory(
        user.uid,
        memory
      );
    }

    return json(res, 200, {
      ok: true,
      action,
      result,
      memory
    });
  } catch (error) {
    console.error("NOVA ERROR:", error);

    return json(res, 500, {
      ok: false,
      error:
        error?.message ||
        "NOVA encountered an unknown error."
    });
  }
}
