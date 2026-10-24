
const MODELS = (
  process.env.GEMINI_MODELS ||
  [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ].join(",")
)
  .split(",")
  .map(model => model.trim())
  .filter(Boolean);

const MAX_HISTORY = 10;
const MAX_MESSAGE_LENGTH = 12000;

function send(res, status, data) {
  return res.status(status).json(data);
}

function getText(value, limit = MAX_MESSAGE_LENGTH) {
  return typeof value === "string"
    ? value.trim().slice(0, limit)
    : "";
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY)
    .map(item => {
      const role = item?.role || item?.sender;
      const text =
        item?.content ||
        item?.text ||
        item?.message ||
        "";

      if (typeof text !== "string" || !text.trim()) {
        return null;
      }

      return {
        role:
          ["assistant", "model", "nova"].includes(
            String(role).toLowerCase()
          )
            ? "model"
            : "user",
        parts: [{ text: text.slice(0, 4000) }]
      };
    })
    .filter(Boolean);
}

function shouldFallback(status, message = "") {
  // أخطاء مؤقتة أو نموذج غير متاح
  if ([404, 408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  // بعض أخطاء النموذج تكون 400، لكن ليست كل أخطاء 400 قابلة للتبديل
  const text = message.toLowerCase();

  return (
    status === 400 &&
    (
      text.includes("model") ||
      text.includes("unsupported") ||
      text.includes("not found")
    )
  );
}

async function askModel(model, apiKey, systemPrompt, history, message) {
  const contents = [
    ...history,
    {
      role: "user",
      parts: [{ text: message }]
    }
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      }),
      signal: AbortSignal.timeout(45000)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || `Gemini returned HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  const reply = (data?.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || "")
    .join("")
    .trim();

  if (!reply) {
    const error = new Error("The model returned an empty response.");
    error.status = 503;
    throw error;
  }

  return reply;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, {
      error: "Method not allowed. Use POST."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return send(res, 500, {
      error: "GEMINI_API_KEY is missing in Vercel Environment Variables."
    });
  }

  const body = req.body || {};
  const message = getText(body.message, MAX_MESSAGE_LENGTH + 1);

  if (!message) {
    return send(res, 400, {
      error: "اكتب رسالتك أولًا."
    });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return send(res, 413, {
      error: "الرسالة طويلة جدًا. اختصرها وحاول مرة ثانية."
    });
  }

  const history = normalizeHistory(body.history);

  const context = body.context && typeof body.context === "object"
    ? body.context
    : {};

  const systemPrompt = `
أنت NOVA، المساعد الذكي الرسمي لمنصة VANTA التعليمية.
مؤسس المنصة ومطورها هو علي ياسر.

قواعدك:
- تحدث بلغة المستخدم، وكن طبيعيًا وواضحًا.
- ساعد في تعلم الحاسوب ومكوناته وأنظمة التشغيل والشبكات والبرمجة وتطوير الويب والأمن السيبراني.
- علّم اختبار الاختراق الأخلاقي داخل بيئات مصرح بها وآمنة.
- أنشئ دروسًا منظمة، أمثلة عملية، أسئلة واختبارات عند الطلب.
- إذا لم يفهم المستخدم، اشرح بطريقة أبسط ولا تكرر الشرح نفسه حرفيًا.
- لا تدّعِ أنك حفظت درسًا أو غيرت إعدادًا أو نفذت إجراءً لم تنفذه فعليًا.
- إذا لم تعرف معلومة، وضح ذلك بدل اختلاقها.
- حافظ على سياق المحادثة والرسائل السابقة.
- اجعل إجاباتك مفيدة ومباشرة، مع تفاصيل إضافية عندما يطلبها المستخدم.

سياق المنصة:
${JSON.stringify({
  product: getText(context.product, 100),
  page: getText(context.page, 100),
  lessons: Array.isArray(context.lessons)
    ? context.lessons.slice(0, 20)
    : [],
  user: {
    name: getText(context.user?.name, 100)
  }
})}
`;

  const errors = [];

  for (const model of MODELS) {
    try {
      const reply = await askModel(
        model,
        apiKey,
        systemPrompt,
        history,
        message
      );

      return send(res, 200, {
        reply,
        model,
        fallbackUsed: errors.length > 0
      });
    } catch (error) {
      const status = Number(error.status || 0);

      console.error(
        `[NOVA] Model ${model} failed:`,
        status,
        error.message
      );

      errors.push({ model, status });

      // أخطاء إعدادات الحساب أو المفتاح لا تستفيد من تبديل النموذج
      if (
        status === 401 ||
        status === 403 ||
        (
          status === 400 &&
          !shouldFallback(status, error.message)
        )
      ) {
        return send(res, 502, {
          error:
            "تعذر تشغيل Gemini بسبب مشكلة في المفتاح أو إعدادات الطلب. راجع سجلات Vercel.",
          model
        });
      }

      if (!shouldFallback(status, error.message) && status !== 0) {
        return send(res, 502, {
          error: "تعذر إكمال الطلب إلى Gemini.",
          model
        });
      }

      // انتقل تلقائيًا إلى النموذج التالي
    }
  }

  return send(res, 503, {
    error:
      "كل نماذج NOVA المتاحة فشلت حاليًا. تحقق من النماذج المدعومة وحدود الاستخدام في حساب Gemini ثم حاول لاحقًا.",
    failedModels: errors.map(item => item.model)
  });
};
