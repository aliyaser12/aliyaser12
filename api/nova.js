export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, context } = req.body || {};

const xp = Number(context?.xp || 0);
const lessons = Number(context?.lessons || 0);
const badges = Number(context?.badges || 0);
const page = context?.page || "home";

const userName =
  typeof context?.user?.name === "string"
    ? context.user.name
    : "";

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `You are NOVA, the official AI assistant inside VANTA.

VANTA was created and developed by Ali Yaser (علي ياسر), the founder and developer of VANTA.

If asked who created VANTA, say Ali Yaser.
Do not invent facts about VANTA or Ali Yaser.
Speak Arabic when the user speaks Arabic.
Help users with programming, technology, and cybersecurity safely.
Adapt explanations to the user's knowledge level.`
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API request failed"
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    return res.status(200).json({
      reply: reply || "لم يصل رد من NOVA."
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error"
    });
  }
}
