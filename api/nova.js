
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();

app.use(cors());
app.use(express.json({ limit: "30kb" }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// ترتيب المحاولة: من الأسرع والأحدث إلى الاحتياطي
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro"
];

const SYSTEM_PROMPT = `
أنت NOVA، المساعد الذكي لمشروع VANTA،
من تطوير علي ياسر.

- تحدث بالعربية افتراضياً وافهم اللهجات العربية.
- ساعد في البرمجة والحاسوب والأمن السيبراني والتعليم.
- أعط إجابات واضحة ومفيدة وأكواداً كاملة عند الحاجة.
- لا تدّع تنفيذ شيء لم تنفذه.
- في الأمن السيبراني، التزم بالتعلم والدفاع
  والاختبارات المصرح بها.
`;

function getStatus(error) {
  return Number(
    error?.status ??
    error?.code ??
    error?.response?.status ??
    0
  );
}

function shouldFallback(error) {
  const status = getStatus(error);
  const message = String(error?.message || "").toLowerCase();

  // الضغط أو عطل مؤقت في الخدمة
  if ([408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  // النموذج غير متاح أو لم يعد مدعوماً
  if (
    status === 404 ||
    message.includes("model not found") ||
    message.includes("model is not found") ||
    message.includes("not supported for generatecontent")
  ) {
    return true;
  }

  return false;
}

app.get("/api/nova/health", (_req, res) => {
  res.json({
    service: "NOVA",
    status: "online",
    provider: "Google Gemini",
    fallbackEnabled: true
  });
});

app.get("/api/nova/models", (_req, res) => {
  res.json({
    provider: "Google Gemini",
    models: MODELS
  });
});

app.post("/api/nova", async (req, res) => {
  const { message, history = [] } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "اكتب رسالتك أولاً"
    });
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          item =>
            item &&
            ["user", "model", "assistant"].includes(item.role) &&
            typeof item.content === "string"
        )
        .slice(-10)
        .map(item => ({
          role: item.role === "assistant" ? "model" : item.role,
          parts: [
            { text: item.content.slice(0, 3000) }
          ]
        }))
    : [];

  const contents = [
    ...safeHistory,
    {
      role: "user",
      parts: [{ text: message.trim().slice(0, 5000) }]
    }
  ];

  const failures = [];

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT
        }
      });

      const reply = response.text;

      if (!reply) {
        throw new Error("Empty response from model");
      }

      return res.json({
        reply,
        model,
        provider: "Google Gemini",
        fallbackUsed: failures.length > 0
      });
    } catch (error) {
      const status = getStatus(error);

      console.error(
        `NOVA model ${model} failed; status=${status}`
      );

      failures.push({ model, status });

      if (!shouldFallback(error)) {
        // أخطاء المفتاح أو الصلاحيات أو الطلب
        // لا تُعالج بتبديل النماذج.
        return res.status(
          status >= 400 && status < 500 ? status : 500
        ).json({
          error: "تعذر تنفيذ الطلب. تحقق من إعدادات Gemini API."
        });
      }

      // ننتقل تلقائياً للنموذج التالي.
      // لا نعرض تفاصيل داخلية أو مفاتيح للمستخدم.
    }
  }

  return res.status(503).json({
    error: "كل نماذج NOVA الاحتياطية مشغولة أو غير متاحة حالياً. جرّب لاحقاً.",
    attemptedModels: failures.map(item => item.model)
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`NOVA Gemini API running on port ${port}`);
});
