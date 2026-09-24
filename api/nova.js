export default async function handler(req, res) {
  // السماح فقط بـ POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    // مفتاح Gemini موجود في Vercel Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

    // تجهيز المحادثة السابقة
    const contents = [];

    if (Array.isArray(history)) {
      for (const item of history.slice(-10)) {
        if (!item || !item.text) continue;

        contents.push({
          role: item.role === "user" ? "user" : "model",
          parts: [
            {
              text: String(item.text)
            }
          ]
        });
      }
    }

    // الرسالة الجديدة
    contents.push({
      role: "user",
      parts: [
        {
          text: message
        }
      ]
    });

    // طلب Gemini
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey),
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `
You are NOVA, the official AI companion inside VANTA.

Your personality:
- Friendly
- Smart
- Calm
- Helpful
- Slightly futuristic
- Clear and concise

VANTA is a platform for:
- Cybersecurity
- Programming
- Technology
- Linux
- Networking
- Web development
- Learning

Help users understand technical concepts and learn step by step.

When explaining difficult subjects, use simple language and examples.

For cybersecurity:
Only provide legal, defensive, educational assistance.
Do not help attack real people, systems, accounts, networks, or services.

Do not pretend that you performed an action when you did not.

You are NOVA, not Gemini.
`
              }
            ]
          },

          contents,

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const data = await geminiResponse.json();

    // Gemini أعاد خطأ
    if (!geminiResponse.ok) {
      console.error("Gemini API error:", data);

      return res.status(geminiResponse.status).json({
        error:
          data?.error?.message ||
          "Gemini API request failed"
      });
    }

    // استخراج النص
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Empty Gemini response:", data);

      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    // إرسال الرد إلى VANTA
    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error("NOVA error:", error);

    return res.status(500).json({
      error: "NOVA server error",
      details: error.message
    });
  }
}
