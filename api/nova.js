
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];

const SYSTEM_PROMPT = `
أنت NOVA، المساعد الذكي الرسمي لمنصة VANTA CYBER.
مؤسس المنصة ومطورها هو علي ياسر.
تحدث بالعربية بشكل افتراضي، وافهم اللهجات العربية.
ساعد المستخدم في الأمن السيبراني والبرمجة والحاسوب والشبكات
ولينوكس والتعلم وحل المشكلات التقنية.
اشرح المعلومات بوضوح وخطوات عملية.
لا تدّعِ أنك نفذت إجراءً لم تنفذه.
لا تختلق نتائج بحث أو معلومات غير مؤكدة.
اجعل إجاباتك منظمة ومناسبة لسؤال المستخدم.
`;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function send(res, status, data) {
  return res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return send(res, 405, {
      error: "الطريقة غير مدعومة",
      message: "أرسل الطلب باستخدام POST"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return send(res, 500, {
      error: "MISSING_API_KEY",
      message: "مفتاح GEMINI_API_KEY غير مضبوط في إعدادات Vercel"
    });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    body = body || {};

    const question = String(
      body.question || body.message || body.prompt || ""
    ).trim();

    if (!question) {
      return send(res, 400, {
        error: "EMPTY_MESSAGE",
        message: "اكتب رسالتك أولًا"
      });
    }

    if (question.length > 20000) {
      return send(res, 413, {
        error: "MESSAGE_TOO_LONG",
        message: "الرسالة طويلة جدًا"
      });
    }

    const history = Array.isArray(body.history)
      ? body.history
      : Array.isArray(body.messages)
        ? body.messages
        : [];

    const contents = [];

    for (const item of history.slice(-20)) {
      if (!item || typeof item !== "object") continue;

      const text = String(
        item.text || item.content || item.message || ""
      ).trim();

      if (!text) continue;

      const roleValue = String(
        item.role || item.sender || ""
      ).toLowerCase();

      const role =
        ["assistant", "model", "nova", "ai"].includes(roleValue)
          ? "model"
          : "user";

      contents.push({
        role,
        parts: [{ text: text.slice(0, 10000) }]
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: question }]
    });

    let lastError = null;

    for (const model of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: SYSTEM_PROMPT }]
                },
                contents,
                generationConfig: {
                  temperature: 0.7,
                  topP: 0.9,
                  maxOutputTokens: 4096
                }
              }),
              signal: AbortSignal.timeout(55000)
            }
          );

          const raw = await response.text();

          let data;

          try {
            data = JSON.parse(raw);
          } catch {
            throw new Error(
              `رد غير صالح من Gemini (${response.status})`
            );
          }

          if (!response.ok) {
            const error = new Error(
              data?.error?.message ||
              `Gemini HTTP ${response.status}`
            );

            error.status = response.status;
            throw error;
          }

          const reply = (data.candidates?.[0]?.content?.parts || [])
            .map((part) => part.text || "")
            .join("")
            .trim();

          if (!reply) {
            throw new Error("لم يرجع Gemini نصًا");
          }

          return send(res, 200, {
            success: true,
            reply,
            nova: "NOVA",
            model
          });
        } catch (error) {
          lastError = error;

          console.error("[NOVA]", {
            model,
            attempt: attempt + 1,
            status: error.status || null,
            message: error.message
          });

          if ([400, 401, 403, 404].includes(error.status)) {
            break;
          }

          if (attempt === 0) {
            await sleep(error.status === 429 ? 1200 : 500);
          }
        }
      }
    }

    console.error("[NOVA] All models failed");

    return send(res, 502, {
      error: "GEMINI_REQUEST_FAILED",
      message: "تعذر الحصول على رد من NOVA",
      details: lastError?.message || "فشل الاتصال بجميع النماذج"
    });
  } catch (error) {
    console.error("[NOVA] Server error:", error);

    return send(res, 500, {
      error: "NOVA_SERVER_ERROR",
      message: "حدث خطأ أثناء تشغيل NOVA"
    });
  }
};
