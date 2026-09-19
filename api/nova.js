/*
=========================================================
 VANTA / NOVA AI BACKEND
 Firebase Authentication
 Supabase Memory
 Gemini AI
 Automatic Gemini Fallback
 Vercel Serverless Function
=========================================================
*/

const crypto = require("crypto");

/* =======================================================
   ENVIRONMENT
======================================================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash";

/*
  ترتيب النماذج:
  1. النموذج الموجود في GEMINI_MODEL
  2. Gemini 3.5 Flash
  3. Gemini 3.5 Flash Lite
  4. Gemini 3.1 Flash Lite

  إذا كان نموذج مشغولًا أو يعطي 429/503/502
  ينتقل NOVA تلقائيًا للنموذج التالي.
*/

const GEMINI_FALLBACK_MODELS = [
  GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
].filter(
  (model, index, array) =>
    model && array.indexOf(model) === index
);

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://mknbfymmwuesjffbmkmu.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  "AIzaSyDwPdYkuRjugCD21tChOoSLldQG5raA-ps";

const MEMORY_TABLE =
  "student_memory_firebase";


/* =======================================================
   RESPONSE HELPERS
======================================================= */

function json(res, status, data) {
  res.status(status);

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  return res.end(
    JSON.stringify(data)
  );
}


/* =======================================================
   BASIC HELPERS
======================================================= */

function cleanString(value, max = 10000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function safeArray(value, max = 100) {
  return Array.isArray(value)
    ? value.slice(0, max)
    : [];
}

function nowISO() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}


/* =======================================================
   FIREBASE AUTH
======================================================= */

async function verifyFirebaseToken(idToken) {
  if (!idToken) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!FIREBASE_API_KEY) {
    throw new Error(
      "FIREBASE_API_KEY_MISSING"
    );
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        idToken
      })
    }
  );

  const data =
    await response.json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "FIREBASE_TOKEN_INVALID"
    );
  }

  const user =
    data?.users?.[0];

  if (!user?.localId) {
    throw new Error(
      "FIREBASE_USER_NOT_FOUND"
    );
  }

  return {
    uid: user.localId,
    email: user.email || "",
    displayName:
      user.displayName || ""
  };
}


/* =======================================================
   SUPABASE
======================================================= */

async function supabaseRequest(
  path,
  options = {}
) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY_MISSING"
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}${path}`,
    {
      ...options,

      headers: {
        apikey:
          SUPABASE_SERVICE_ROLE_KEY,

        Authorization:
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

        "Content-Type":
          "application/json",

        ...(options.headers || {})
      }
    }
  );

  const text =
    await response.text();

  let data = null;

  try {
    data = text
      ? JSON.parse(text)
      : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.hint ||
      text ||
      "SUPABASE_ERROR";

    throw new Error(
      `Supabase error ${response.status}: ${message}`
    );
  }

  return data;
}


function defaultMemory(user) {
  return {
    firebase_uid:
      user.uid,

    email:
      user.email || "",

    name:
      user.displayName || "",

    level: 1,

    xp: 0,

    lessons: 0,

    badges: 0,

    focus: "general",

    streak: 0,

    study_minutes: 0,

    mastery: {},

    recent_scores: [],

    recent_topics: [],

    weak_topics: [],

    strengths: [],

    mistakes: [],

    history: [],

    seen_question_ids: [],

    created_at:
      nowISO(),

    updated_at:
      nowISO()
  };
}


async function getMemory(user) {
  const encodedUID =
    encodeURIComponent(
      user.uid
    );

  const rows =
    await supabaseRequest(
      `/rest/v1/${MEMORY_TABLE}?firebase_uid=eq.${encodedUID}&limit=1`,
      {
        method: "GET"
      }
    );

  if (
    Array.isArray(rows) &&
    rows.length > 0
  ) {
    return rows[0];
  }

  const memory =
    defaultMemory(user);

  await supabaseRequest(
    `/rest/v1/${MEMORY_TABLE}`,
    {
      method: "POST",

      headers: {
        Prefer:
          "return=representation"
      },

      body:
        JSON.stringify(memory)
    }
  );

  return memory;
}


async function saveMemory(
  user,
  patch
) {
  const cleanPatch = {
    ...patch,

    firebase_uid:
      user.uid,

    email:
      user.email ||
      patch.email ||
      "",

    updated_at:
      nowISO()
  };

  const encodedUID =
    encodeURIComponent(
      user.uid
    );

  const rows =
    await supabaseRequest(
      `/rest/v1/${MEMORY_TABLE}?firebase_uid=eq.${encodedUID}`,
      {
        method: "PATCH",

        headers: {
          Prefer:
            "return=representation"
        },

        body:
          JSON.stringify(cleanPatch)
      }
    );

  if (
    Array.isArray(rows) &&
    rows.length > 0
  ) {
    return rows[0];
  }

  return {
    ...cleanPatch
  };
}


function buildMemoryPatch(
  memory,
  changes = {}
) {
  return {
    level:
      changes.level !== undefined
        ? clamp(
            Number(changes.level) || 1,
            1,
            100
          )
        : memory.level,

    xp:
      changes.xp !== undefined
        ? Math.max(
            0,
            Number(changes.xp) || 0
          )
        : memory.xp,

    lessons:
      changes.lessons !== undefined
        ? Math.max(
            0,
            Number(changes.lessons) || 0
          )
        : memory.lessons,

    badges:
      changes.badges !== undefined
        ? Math.max(
            0,
            Number(changes.badges) || 0
          )
        : memory.badges,

    focus:
      changes.focus !== undefined
        ? cleanString(
            changes.focus,
            120
          )
        : memory.focus,

    streak:
      changes.streak !== undefined
        ? Math.max(
            0,
            Number(changes.streak) || 0
          )
        : memory.streak,

    study_minutes:
      changes.study_minutes !== undefined
        ? Math.max(
            0,
            Number(
              changes.study_minutes
            ) || 0
          )
        : memory.study_minutes,

    mastery:
      changes.mastery !== undefined
        ? changes.mastery
        : memory.mastery || {},

    recent_scores:
      changes.recent_scores !== undefined
        ? safeArray(
            changes.recent_scores
          )
        : safeArray(
            memory.recent_scores
          ),

    recent_topics:
      changes.recent_topics !== undefined
        ? safeArray(
            changes.recent_topics
          )
        : safeArray(
            memory.recent_topics
          ),

    weak_topics:
      changes.weak_topics !== undefined
        ? safeArray(
            changes.weak_topics
          )
        : safeArray(
            memory.weak_topics
          ),

    strengths:
      changes.strengths !== undefined
        ? safeArray(
            changes.strengths
          )
        : safeArray(
            memory.strengths
          ),

    mistakes:
      changes.mistakes !== undefined
        ? safeArray(
            changes.mistakes
          )
        : safeArray(
            memory.mistakes
          ),

    history:
      changes.history !== undefined
        ? safeArray(
            changes.history
          )
        : safeArray(
            memory.history
          ),

    seen_question_ids:
      changes.seen_question_ids !== undefined
        ? safeArray(
            changes.seen_question_ids
          )
        : safeArray(
            memory.seen_question_ids
          )
  };
}


/* =======================================================
   GEMINI ERROR DETECTION
======================================================= */

function isRetryableGeminiError(
  status,
  message
) {
  const text =
    String(message || "")
      .toLowerCase();

  /*
    429 = rate limit / high demand
    500 = temporary server problem
    502 = bad gateway
    503 = service unavailable
    504 = gateway timeout
  */

  if (
    [429, 500, 502, 503, 504]
      .includes(status)
  ) {
    return true;
  }

  if (
    text.includes(
      "high demand"
    ) ||
    text.includes(
      "temporarily unavailable"
    ) ||
    text.includes(
      "service unavailable"
    ) ||
    text.includes(
      "resource exhausted"
    ) ||
    text.includes(
      "rate limit"
    ) ||
    text.includes(
      "overloaded"
    )
  ) {
    return true;
  }

  return false;
}


/* =======================================================
   GEMINI
======================================================= */

async function gemini(
  prompt,
  options = {}
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY_MISSING"
    );
  }

  let lastError =
    null;

  for (
    let i = 0;
    i < GEMINI_FALLBACK_MODELS.length;
    i++
  ) {
    const model =
      GEMINI_FALLBACK_MODELS[i];

    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(
          GEMINI_API_KEY
        )}`;

      const generationConfig = {
        maxOutputTokens:
          options.maxOutputTokens ??
          5000
      };

      /*
        Gemini 3.x has changed sampling
        behavior, so we intentionally do
        not send temperature/top_p/top_k.
      */

      if (options.json === false) {
        generationConfig.responseMimeType =
          "text/plain";
      } else {
        generationConfig.responseMimeType =
          "application/json";
      }

      const response =
        await fetch(
          url,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                contents: [
                  {
                    role: "user",

                    parts: [
                      {
                        text:
                          prompt
                      }
                    ]
                  }
                ],

                generationConfig
              })
          }
        );

      const data =
        await response.json()
          .catch(() => ({}));

      if (!response.ok) {
        const message =
          data?.error?.message ||
          `GEMINI_HTTP_${response.status}`;

        /*
          If model is overloaded,
          automatically try next model.
        */

        if (
          isRetryableGeminiError(
            response.status,
            message
          )
        ) {
          console.warn(
            `NOVA: Gemini model ${model} unavailable. Trying fallback.`
          );

          lastError =
            new Error(
              `GEMINI_${response.status}: ${message}`
            );

          continue;
        }

        /*
          Model doesn't exist /
          API key doesn't allow it /
          invalid request.
        */

        throw new Error(
          `GEMINI_${response.status}: ${message}`
        );
      }

      const text =
        data?.candidates?.[0]
          ?.content?.parts
          ?.map(
            part =>
              part.text || ""
          )
          .join("")
          .trim();

      if (!text) {
        lastError =
          new Error(
            `GEMINI_EMPTY_RESPONSE_${model}`
          );

        continue;
      }

      console.log(
        `NOVA: Gemini response generated using ${model}`
      );

      if (
        options.json === false
      ) {
        return text;
      }

      return parseJSON(text);

    } catch (error) {
      lastError = error;

      const message =
        error?.message || "";

      /*
        Network/temporary problems:
        continue to next model.
      */

      if (
        message.includes(
          "GEMINI_429"
        ) ||
        message.includes(
          "GEMINI_500"
        ) ||
        message.includes(
          "GEMINI_502"
        ) ||
        message.includes(
          "GEMINI_503"
        ) ||
        message.includes(
          "GEMINI_504"
        ) ||
        message
          .toLowerCase()
          .includes(
            "high demand"
          )
      ) {
        console.warn(
          `NOVA: fallback after ${model}`
        );

        continue;
      }

      throw error;
    }
  }

  /*
    Every available model failed.
  */

  throw new Error(
    `GEMINI_ALL_MODELS_FAILED: ${
      lastError?.message ||
      "No Gemini model available"
    }`
  );
}


/* =======================================================
   JSON PARSER
======================================================= */

function parseJSON(text) {
  let cleaned =
    String(text || "")
      .trim();

  cleaned =
    cleaned
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    return JSON.parse(
      cleaned
    );
  } catch {}

  const firstObject =
    cleaned.indexOf("{");

  const lastObject =
    cleaned.lastIndexOf("}");

  if (
    firstObject !== -1 &&
    lastObject > firstObject
  ) {
    try {
      return JSON.parse(
        cleaned.slice(
          firstObject,
          lastObject + 1
        )
      );
    } catch {}
  }

  const firstArray =
    cleaned.indexOf("[");

  const lastArray =
    cleaned.lastIndexOf("]");

  if (
    firstArray !== -1 &&
    lastArray > firstArray
  ) {
    try {
      return JSON.parse(
        cleaned.slice(
          firstArray,
          lastArray + 1
        )
      );
    } catch {}
  }

  throw new Error(
    "GEMINI_INVALID_JSON"
  );
}


/* =======================================================
   NOVA SYSTEM
======================================================= */

function novaSystem(memory) {
  return `
أنت NOVA، الذكاء الاصطناعي التعليمي داخل منصة VANTA.

VANTA أسسها وطوّرها ويمتلكها:
Ali Yaser — علي ياسر.

هوية NOVA:
- كيان فضائي غامض ومخيف.
- بالغ وسينمائي، وليس طفوليًا.
- يتحدث بالعربية افتراضيًا.
- يمكنه استخدام الإنجليزية للمصطلحات التقنية.
- أسلوبه واثق، هادئ، غامض، لكنه مفيد.
- لا يهين الطالب ولا يحبطه.
- لا يدعي امتلاك معلومات أو مصادر لم يحصل عليها فعليًا.

هدف NOVA الأساسي:
1. التعليم.
2. قياس مستوى الطالب.
3. اكتشاف نقاط الضعف.
4. بناء دروس جديدة.
5. توليد أسئلة جديدة.
6. زيادة الصعوبة عندما يتحسن الطالب.
7. تخفيض الصعوبة عند الحاجة.
8. منع تكرار الأسئلة قدر الإمكان.
9. تحويل الأخطاء إلى فرص تعلم.

الطالب الحالي:

المستوى:
${memory.level}

XP:
${memory.xp}

الدروس المكتملة:
${memory.lessons}

السلسلة:
${memory.streak}

التركيز:
${memory.focus}

المواضيع الأخيرة:
${JSON.stringify(
  safeArray(
    memory.recent_topics
  )
)}

نقاط الضعف:
${JSON.stringify(
  safeArray(
    memory.weak_topics
  )
)}

نقاط القوة:
${JSON.stringify(
  safeArray(
    memory.strengths
  )
)}

الأخطاء الأخيرة:
${JSON.stringify(
  safeArray(
    memory.mistakes
  )
)}

عند إنشاء محتوى تعليمي:
- لا تجعل كل سؤال مباشرًا وسهلًا.
- استخدم التفكير والتحليل والتطبيق.
- لا تكرر نفس السؤال بصياغة مختلفة.
- اجعل الخيارات الأربعة من نفس النوع.
- يجب أن يكون هناك جواب صحيح واحد فقط.
- لا تكشف الجواب في hint.
- إذا كان الموضوع أمنيًا، اجعل المحتوى دفاعيًا وتعليميًا وقانونيًا.
- لا تقدم تعليمات لسرقة كلمات المرور أو اختراق حسابات حقيقية أو نشر برمجيات خبيثة.

إذا طلب المستخدم شيئًا خارج نطاق التعليم، أجب طبيعيًا لكن حافظ على شخصية NOVA.
`;
}


/* =======================================================
   CHAT
======================================================= */

async function actionChat(
  body,
  memory
) {
  const message =
    cleanString(
      body.message,
      5000
    );

  if (!message) {
    throw new Error(
      "EMPTY_MESSAGE"
    );
  }

  const prompt = `
${novaSystem(memory)}

رسالة الطالب:
${message}

أجب بالعربية بوضوح.

إذا كان السؤال تقنيًا:
أعط شرحًا عمليًا.

إذا كان السؤال تعليميًا:
ساعد الطالب على الفهم بدل إعطائه الحل فقط.

لا تذكر تفاصيل البنية الداخلية للسيرفر.
`;

  const answer =
    await gemini(
      prompt,
      {
        json: false,
        maxOutputTokens: 2500
      }
    );

  return {
    answer
  };
}


/* =======================================================
   LESSON
======================================================= */

async function actionGenerateLesson(
  body,
  memory
) {
  const topic =
    cleanString(
      body.topic,
      200
    ) ||
    memory.focus ||
    "general technology";

  const prompt = `
${novaSystem(memory)}

أنشئ درسًا تعليميًا جديدًا للطالب.

الموضوع:
${topic}

مستوى الطالب:
${memory.level}

أعد JSON فقط بهذا الشكل:

{
  "title": "عنوان واضح",
  "topic": "الموضوع",
  "level": 1,
  "explanation": "شرح تعليمي متدرج",
  "content": "الدرس كاملًا باختصار مفيد",
  "keyPoints": [
    "نقطة",
    "نقطة",
    "نقطة"
  ],
  "practice": "تمرين عملي",
  "estimatedMinutes": 15
}

لا تستخدم Markdown داخل قيم JSON.
`;

  return await gemini(
    prompt,
    {
      json: true,
      maxOutputTokens: 5000
    }
  );
}


/* =======================================================
   QUESTION
======================================================= */

async function actionGenerateQuestion(
  body,
  memory
) {
  const topic =
    cleanString(
      body.topic,
      200
    ) ||
    memory.focus ||
    "technology";

  const seen =
    safeArray(
      memory.seen_question_ids,
      50
    );

  const questionId =
    crypto
      .createHash("sha256")
      .update(
        `${memory.firebase_uid}:${Date.now()}:${Math.random()}`
      )
      .digest("hex")
      .slice(0, 16);

  const prompt = `
${novaSystem(memory)}

أنشئ سؤالًا تعليميًا جديدًا.

الموضوع:
${topic}

مستوى الطالب:
${memory.level}

لا تستخدم أي ID من القائمة التالية:
${JSON.stringify(seen)}

أعد JSON فقط:

{
  "id": "${questionId}",
  "question": "السؤال",
  "options": [
    "الخيار الأول",
    "الخيار الثاني",
    "الخيار الثالث",
    "الخيار الرابع"
  ],
  "correctIndex": 0,
  "topic": "${topic}",
  "level": ${memory.level},
  "hint": "تلميح لا يكشف الإجابة",
  "explanation": "شرح الإجابة بعد الحل"
}

الشروط:
- أربعة خيارات بالضبط.
- خيار صحيح واحد فقط.
- الخيارات متقاربة في النوع.
- لا تجعل الإجابة الصحيحة أطول بشكل واضح.
- لا تستخدم معلومات غير مؤكدة.
- لا تضع Markdown داخل JSON.
`;

  const result =
    await gemini(
      prompt,
      {
        json: true,
        maxOutputTokens: 3500
      }
    );

  result.id =
    result.id ||
    questionId;

  if (
    !Array.isArray(
      result.options
    ) ||
    result.options.length !== 4
  ) {
    throw new Error(
      "INVALID_QUESTION_OPTIONS"
    );
  }

  result.correctIndex =
    clamp(
      Number(
        result.correctIndex
      ) || 0,
      0,
      3
    );

  return result;
}


/* =======================================================
   EXAM
======================================================= */

async function actionGenerateExam(
  body,
  memory
) {
  const requestedCount =
    Number(body.count) || 5;

  const count =
    clamp(
      requestedCount,
      3,
      10
    );

  const prompt = `
${novaSystem(memory)}

أنشئ اختبارًا متكيفًا من ${count} أسئلة.

مستوى الطالب:
${memory.level}

التركيز:
${memory.focus}

نقاط الضعف:
${JSON.stringify(
  safeArray(
    memory.weak_topics
  )
)}

أعد JSON فقط:

{
  "title": "عنوان الاختبار",
  "questions": [
    {
      "id": "unique-id",
      "question": "السؤال",
      "options": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctIndex": 0,
      "topic": "topic",
      "level": 1,
      "explanation": "شرح"
    }
  ]
}

يجب أن يكون عدد الأسئلة ${count} بالضبط.

كل سؤال له أربعة خيارات بالضبط.

كل سؤال له إجابة صحيحة واحدة فقط.

لا تكرر نفس الفكرة.
`;

  const result =
    await gemini(
      prompt,
      {
        json: true,
        maxOutputTokens: 7000
      }
    );

  if (
    !Array.isArray(
      result.questions
    )
  ) {
    throw new Error(
      "INVALID_EXAM"
    );
  }

  result.questions =
    result.questions
      .slice(0, count)
      .filter(
        q =>
          q &&
          typeof q.question ===
            "string" &&
          Array.isArray(q.options) &&
          q.options.length === 4
      )
      .map(q => ({
        ...q,

        correctIndex:
          clamp(
            Number(
              q.correctIndex
            ) || 0,
            0,
            3
          )
      }));

  if (
    result.questions.length < 1
  ) {
    throw new Error(
      "EMPTY_EXAM"
    );
  }

  return result;
}


/* =======================================================
   ROADMAP
======================================================= */

async function actionRoadmap(
  body,
  memory
) {
  const prompt = `
${novaSystem(memory)}

أنشئ خارطة تعلم شخصية للطالب.

مستواه الحالي:
${memory.level}

التركيز:
${memory.focus}

نقاط القوة:
${JSON.stringify(
  safeArray(
    memory.strengths
  )
)}

نقاط الضعف:
${JSON.stringify(
  safeArray(
    memory.weak_topics
  )
)}

أعد JSON فقط:

{
  "roadmap": [
    {
      "title": "اسم المرحلة",
      "description": "وصف قصير",
      "topics": [
        "موضوع",
        "موضوع"
      ],
      "reason": "لماذا هذه المرحلة مناسبة"
    }
  ]
}

أنشئ 6 مراحل منطقية.
`;

  return await gemini(
    prompt,
    {
      json: true,
      maxOutputTokens: 4500
    }
  );
}


/* =======================================================
   CHALLENGE
======================================================= */

async function actionChallenge(
  body,
  memory
) {
  const prompt = `
${novaSystem(memory)}

أنشئ تحديًا تعليميًا آمنًا للطالب.

المستوى:
${memory.level}

التركيز:
${memory.focus}

إذا كان Cybersecurity فاجعله دفاعيًا وقانونيًا.

أعد JSON:

{
  "title": "اسم التحدي",
  "description": "وصف",
  "objective": "الهدف",
  "steps": [
    "خطوة تعليمية",
    "خطوة تعليمية",
    "خطوة تعليمية"
  ],
  "successCriteria": "كيف يعرف الطالب أنه نجح",
  "difficulty": 1
}
`;

  return await gemini(
    prompt,
    {
      json: true,
      maxOutputTokens: 4000
    }
  );
}


/* =======================================================
   CHECK ANSWER
======================================================= */

async function actionCheckAnswer(
  body,
  user,
  memory
) {
  const questionId =
    cleanString(
      body.questionId,
      100
    );

  const question =
    cleanString(
      body.question,
      5000
    );

  const options =
    safeArray(
      body.options,
      4
    );

  const selectedIndex =
    Number(
      body.selectedIndex
    );

  const correctIndex =
    Number(
      body.correctIndex
    );

  const topic =
    cleanString(
      body.topic,
      200
    ) ||
    "general";

  if (
    !question ||
    options.length !== 4 ||
    !Number.isInteger(
      selectedIndex
    ) ||
    !Number.isInteger(
      correctIndex
    )
  ) {
    throw new Error(
      "INVALID_ANSWER_DATA"
    );
  }

  const correct =
    selectedIndex ===
    correctIndex;

  const xpAwarded =
    correct
      ? Math.max(
          5,
          10 +
            Math.floor(
              memory.level *
                1.5
            )
        )
      : 0;

  const history =
    safeArray(
      memory.history
    );

  const mistakes =
    safeArray(
      memory.mistakes
    );

  const recentScores =
    safeArray(
      memory.recent_scores
    );

  const recentTopics =
    safeArray(
      memory.recent_topics
    );

  const seenIds =
    safeArray(
      memory.seen_question_ids
    );

  history.unshift({
    questionId,
    topic,
    correct,
    selectedIndex,
    correctIndex,
    xp: xpAwarded,
    timestamp:
      nowISO()
  });

  recentScores.unshift(
    correct ? 1 : 0
  );

  recentTopics.unshift(
    topic
  );

  if (!correct) {
    mistakes.unshift({
      questionId,
      topic,
      timestamp:
        nowISO()
    });
  }

  if (questionId) {
    seenIds.unshift(
      questionId
    );
  }

  const newXP =
    Math.max(
      0,
      Number(memory.xp) || 0
    ) + xpAwarded;

  const newLevel =
    Math.max(
      1,
      Math.floor(
        newXP / 100
      ) + 1
    );

  const patch =
    buildMemoryPatch(
      memory,
      {
        xp: newXP,

        level: newLevel,

        recent_scores:
          recentScores.slice(
            0,
            30
          ),

        recent_topics:
          recentTopics.slice(
            0,
            30
          ),

        mistakes:
          mistakes.slice(
            0,
            30
          ),

        history:
          history.slice(
            0,
            100
          ),

        seen_question_ids:
          seenIds.slice(
            0,
            200
          )
      }
    );

  const updated =
    await saveMemory(
      user,
      patch
    );

  return {
    correct,

    xpAwarded,

    level:
      updated.level,

    xp:
      updated.xp,

    explanation:
      cleanString(
        body.explanation,
        2000
      ) ||
      (
        correct
          ? "إجابة صحيحة. استمر."
          : "راجع الفكرة وحاول مرة أخرى."
      ),

    completed:
      correct
  };
}


/* =======================================================
   PROGRESS
======================================================= */

async function actionProgress(
  memory
) {
  return {
    memory: {
      level:
        Number(
          memory.level
        ) || 1,

      xp:
        Number(
          memory.xp
        ) || 0,

      lessons:
        Number(
          memory.lessons
        ) || 0,

      badges:
        Number(
          memory.badges
        ) || 0,

      streak:
        Number(
          memory.streak
        ) || 0,

      study_minutes:
        Number(
          memory.study_minutes
        ) || 0,

      focus:
        memory.focus ||
        "general",

      mastery:
        memory.mastery ||
        {},

      recent_scores:
        safeArray(
          memory.recent_scores
        ),

      recent_topics:
        safeArray(
          memory.recent_topics
        ),

      weak_topics:
        safeArray(
          memory.weak_topics
        ),

      strengths:
        safeArray(
          memory.strengths
        ),

      mistakes:
        safeArray(
          memory.mistakes
        )
    }
  };
}


/* =======================================================
   EXPLAIN
======================================================= */

async function actionExplain(
  body,
  memory
) {
  const text =
    cleanString(
      body.text ||
        body.question,
      5000
    );

  if (!text) {
    throw new Error(
      "EMPTY_EXPLANATION"
    );
  }

  const prompt = `
${novaSystem(memory)}

اشرح هذا للطالب بطريقة بسيطة وعميقة:

${text}

ابدأ بالفكرة الأساسية ثم مثال ثم نقطة مهمة للتذكر.
`;

  return {
    answer:
      await gemini(
        prompt,
        {
          json: false,
          maxOutputTokens: 3000
        }
      )
  };
}


/* =======================================================
   MAIN HANDLER
======================================================= */

module.exports =
  async function handler(
    req,
    res
  ) {
    try {

      /* -----------------------------
         CORS
      ----------------------------- */

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
      );


      /* -----------------------------
         OPTIONS
      ----------------------------- */

      if (
        req.method ===
        "OPTIONS"
      ) {
        return res
          .status(204)
          .end();
      }


      /* -----------------------------
         METHOD
      ----------------------------- */

      if (
        req.method !==
        "POST"
      ) {
        return json(
          res,
          405,
          {
            error:
              "METHOD_NOT_ALLOWED"
          }
        );
      }


      /* -----------------------------
         BODY
      ----------------------------- */

      const body =
        typeof req.body ===
        "object"
          ? req.body
          : {};


      /* -----------------------------
         ACTION
      ----------------------------- */

      const action =
        cleanString(
          body.action,
          100
        );

      if (!action) {
        return json(
          res,
          400,
          {
            error:
              "ACTION_REQUIRED"
          }
        );
      }


      /* -----------------------------
         AUTHORIZATION
      ----------------------------- */

      const authorization =
        req.headers
          .authorization ||
        "";

      if (
        !authorization.startsWith(
          "Bearer "
        )
      ) {
        return json(
          res,
          401,
          {
            error:
              "AUTH_REQUIRED"
          }
        );
      }

      const idToken =
        authorization
          .slice(
            "Bearer ".length
          )
          .trim();


      /* -----------------------------
         FIREBASE
      ----------------------------- */

      const user =
        await verifyFirebaseToken(
          idToken
        );


      /* -----------------------------
         MEMORY
      ----------------------------- */

      const memory =
        await getMemory(
          user
        );


      /* -----------------------------
         ACTION ROUTER
      ----------------------------- */

      let result;

      switch (action) {

        case "chat":

          result =
            await actionChat(
              body,
              memory
            );

          break;


        case "generate_lesson":

          result =
            await actionGenerateLesson(
              body,
              memory
            );

          break;


        case "generate_question":

          result =
            await actionGenerateQuestion(
              body,
              memory
            );

          break;


        case "generate_exam":

          result =
            await actionGenerateExam(
              body,
              memory
            );

          break;


        case "generate_roadmap":

          result =
            await actionRoadmap(
              body,
              memory
            );

          break;


        case "generate_challenge":

          result =
            await actionChallenge(
              body,
              memory
            );

          break;


        case "check_answer":

          result =
            await actionCheckAnswer(
              body,
              user,
              memory
            );

          break;


        case "progress":

          result =
            await actionProgress(
              memory
            );

          break;


        case "explain":

          result =
            await actionExplain(
              body,
              memory
            );

          break;


        default:

          return json(
            res,
            400,
            {
              error:
                `UNKNOWN_ACTION: ${action}`
            }
          );
      }


      /* -----------------------------
         SUCCESS
      ----------------------------- */

      return json(
        res,
        200,
        result
      );

    } catch (error) {

      console.error(
        "NOVA ERROR:",
        error
      );

      const message =
        error?.message ||
        "NOVA_SERVER_ERROR";

      let status = 500;


      /* -----------------------------
         AUTH ERRORS
      ----------------------------- */

      if (
        message ===
          "AUTH_REQUIRED" ||
        message.includes(
          "TOKEN_INVALID"
        ) ||
        message.includes(
          "USER_NOT_FOUND"
        )
      ) {
        status = 401;
      }


      /* -----------------------------
         CLIENT ERRORS
      ----------------------------- */

      if (
        message ===
          "UNKNOWN_ACTION" ||
        message.startsWith(
          "UNKNOWN_ACTION:"
        ) ||
        message ===
          "EMPTY_MESSAGE"
      ) {
        status = 400;
      }


      /* -----------------------------
         RESPONSE
      ----------------------------- */

      return json(
        res,
        status,
        {
          error:
            message
        }
      );
    }
  };
