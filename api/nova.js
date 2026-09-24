export default async function handler(req, res) {
  // =========================
  // CORS
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // =========================
  // ENV
  // =========================
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing"
    });
  }

  // =========================
  // BODY
  // =========================
  let body;

  try {
    body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};
  } catch {
    return res.status(400).json({
      error: "Invalid JSON"
    });
  }

  const message = String(body.message || "").trim();

  if (!message) {
    return res.status(400).json({
      error: "Message is required"
    });
  }

  // =========================
  // USER DATA FROM FRONTEND
  // =========================
  const frontendUser = body.user || {};

  let user = {
    firebase_uid:
      frontendUser.firebase_uid ||
      frontendUser.firebaseUid ||
      frontendUser.uid ||
      null,

    username:
      frontendUser.username ||
      frontendUser.name ||
      null,

    level:
      Number.isFinite(Number(frontendUser.level))
        ? Number(frontendUser.level)
        : 1,

    xp:
      Number.isFinite(Number(frontendUser.xp))
        ? Number(frontendUser.xp)
        : 0,

    currentPage: frontendUser.currentPage || "",
    language: frontendUser.language || "ar",
    recentTopics: Array.isArray(frontendUser.recentTopics)
      ? frontendUser.recentTopics
      : [],
    likedCategories: Array.isArray(frontendUser.likedCategories)
      ? frontendUser.likedCategories
      : [],
    bookProgress: frontendUser.bookProgress || {},
    vantabookActivity: frontendUser.vantabookActivity || {}
  };

  // =========================
  // READ REAL USER DATA
  // FROM student_memory_firebase
  // =========================
  if (
    SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY &&
    user.firebase_uid
  ) {
    try {
      const query =
        `${SUPABASE_URL}/rest/v1/student_memory_firebase` +
        `?firebase_uid=eq.${encodeURIComponent(user.firebase_uid)}` +
        `&select=firebase_uid,email,name,level,xp` +
        `&limit=1`;

      const profileResponse = await fetch(query, {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json"
        }
      });

      if (profileResponse.ok) {
        const profiles = await profileResponse.json();

        if (Array.isArray(profiles) && profiles.length > 0) {
          const profile = profiles[0];

          user.username =
            profile.name ||
            user.username ||
            profile.email ||
            "المستخدم";

          user.level =
            Number.isFinite(Number(profile.level))
              ? Number(profile.level)
              : user.level;

          user.xp =
            Number.isFinite(Number(profile.xp))
              ? Number(profile.xp)
              : user.xp;

          user.firebase_uid =
            profile.firebase_uid ||
            user.firebase_uid;
        }
      } else {
        const errorText = await profileResponse.text();

        console.error(
          "Supabase profile lookup failed:",
          profileResponse.status,
          errorText
        );
      }
    } catch (error) {
      console.error(
        "Supabase profile lookup error:",
        error?.message || error
      );
    }
  }

  // =========================
  // HISTORY
  // =========================
  const rawHistory = Array.isArray(body.history)
    ? body.history
    : [];

  const history = rawHistory
    .slice(-16)
    .map((item) => {
      const role =
        item?.role === "assistant"
          ? "model"
          : "user";

      const text = String(
        item?.content ||
        item?.text ||
        ""
      ).trim();

      return {
        role,
        parts: [
          {
            text
          }
        ]
      };
    })
    .filter((item) => item.parts[0].text);

  // =========================
  // SYSTEM PROMPT
  // =========================
  const systemPrompt = `
أنت NOVA، المساعد الذكي المركزي داخل VANTA.

VANTA منصة تعليمية وتقنية واجتماعية، وVANTABOOK جزء اجتماعي متكامل داخلها.

مهمتك:
- مساعدة المستخدم في التعلم.
- فهم سياقه داخل VANTA.
- فهم مستواه وXP الخاص به.
- مساعدته في VANTABOOK.
- الإجابة بالعربية عندما يكون المستخدم عربيًا.
- كن طبيعيًا وذكيًا ومختصرًا، ولا تتصرف كروبوت جامد.
- لا تدّعي معرفة معلومات غير موجودة في سياقك.

بيانات المستخدم الحالية:
الاسم: ${user.username || "غير معروف"}
المستوى: Level ${user.level}
XP: ${user.xp}
Firebase UID: ${user.firebase_uid || "غير متوفر"}
الصفحة الحالية: ${user.currentPage || "غير معروفة"}
اللغة: ${user.language || "ar"}

المواضيع الأخيرة:
${JSON.stringify(user.recentTopics)}

التصنيفات التي تفاعل معها:
${JSON.stringify(user.likedCategories)}

تقدم الكتب:
${JSON.stringify(user.bookProgress)}

نشاط VANTABOOK:
${JSON.stringify(user.vantabookActivity)}

إذا سألك المستخدم:
"مين أنا؟"
استخدم اسم المستخدم الحقيقي الموجود في بياناته.

إذا سألك:
"كم مستواي؟"
استخدم Level الموجود في بياناته.

إذا سألك:
"كم عندي XP؟"
استخدم XP الموجود في بياناته.

لا تقل إن المستخدم Level 1 أو لديه 0 XP إذا كانت البيانات الحقيقية المرسلة لك مختلفة.

نظام XP:
- XP يمثل خبرة المستخدم داخل VANTA.
- Level يمثل مستوى المستخدم.
- لا تخترع XP أو Level جديدًا.
- إذا لم تكن البيانات متوفرة، قل بوضوح إن بيانات التقدم غير متاحة بدل اختراعها.

الأمن السيبراني:
يمكنك شرح الأمن السيبراني بشكل تعليمي ودفاعي.
لا تساعد في سرقة الحسابات أو كلمات المرور أو اختراق أنظمة حقيقية أو تجاوز الحماية.

أنت جزء من VANTA وVANTABOOK، لذلك حافظ على سياق المنصة عند الإجابة.
`;

  // =========================
  // GEMINI MODELS
  // =========================
  const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite"
  ];

  let lastError = null;
  let hadRateLimit = false;

  // =========================
  // TRY MODELS
  // =========================
  for (const model of MODELS) {
    try {
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const contents = [
        ...history,
        {
          role: "user",
          parts: [
            {
              text: message
            }
          ]
        }
      ];

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: systemPrompt
              }
            ]
          },

          contents,

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200
          }
        })
      });

      const rawText = await response.text();

      let data;

      try {
        data = JSON.parse(rawText);
      } catch {
        data = {};
      }

      // =========================
      // SUCCESS
      // =========================
      if (response.ok) {
        const reply =
          data?.candidates?.[0]?.content?.parts
            ?.map((part) => part?.text || "")
            .join("")
            .trim();

        if (reply) {
          return res.status(200).json({
            reply,
            model,
            fallback: model !== MODELS[0]
          });
        }

        lastError = "Gemini returned an empty response.";
        continue;
      }

      // =========================
      // RATE LIMIT
      // =========================
      if (response.status === 429) {
        hadRateLimit = true;

        console.error(
          `NOVA model ${model} rate limited:`,
          rawText
        );

        lastError = rawText;
        continue;
      }

      // =========================
      // MODEL NOT AVAILABLE
      // =========================
      if (response.status === 404) {
        console.error(
          `NOVA model ${model} failed: 404`,
          rawText
        );

        lastError = rawText;
        continue;
      }

      // =========================
      // OTHER ERROR
      // =========================
      console.error(
        `NOVA model ${model} failed: ${response.status}`,
        rawText
      );

      lastError = rawText;
    } catch (error) {
      console.error(
        `NOVA model ${model} exception:`,
        error?.message || error
      );

      lastError = error?.message || String(error);
    }
  }

  // =========================
  // ALL MODELS FAILED
  // =========================
  if (hadRateLimit) {
    return res.status(429).json({
      error:
        "NOVA rate limit reached. All available models are currently unavailable.",
      details: lastError
    });
  }

  return res.status(503).json({
    error: "NOVA is currently unavailable.",
    details: lastError
  });
}
