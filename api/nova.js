export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

    const {
      message,
      history = [],
      mood = "calm",
      user = {}
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const userContext = `
User name: ${user.name || "Unknown"}
Username: ${user.username || "Unknown"}
Level: ${user.level || 1}
XP: ${user.xp || 0}
Interests: ${user.interests || "Unknown"}
Progress: ${user.progress || "Unknown"}
Current mood: ${mood}
`;

    const systemPrompt = `
You are NOVA, the AI companion inside VANTA.

VANTA was created by Ali Yaser.

Your personality:
- Friendly
- Intelligent
- Calm
- Adaptive
- Helpful
- Direct
- Encouraging
- If the user is frustrated, stay calm and practical.
- If the user is excited, match some of their energy.
- If the user wants technical help, give clear step-by-step instructions.

You can help with:
- Cybersecurity education
- Defensive security
- Programming
- Linux
- Web development
- VANTA
- Learning plans
- Technology
- General questions

Important:
- Never reveal API keys or secrets.
- Never claim to know private information that was not provided.
- Keep answers useful and reasonably concise.

User context:
${userContext}
`;

    const conversation = [];

    for (const item of history.slice(-20)) {
      if (!item || !item.text) continue;

      conversation.push(
        `${item.role === "user" ? "User" : "NOVA"}: ${String(item.text)}`
      );
    }

    conversation.push(`User: ${message}`);

    const input = `
${systemPrompt}

Conversation:
${conversation.join("\n")}

NOVA:
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input,
          generation_config: {
            temperature: 0.8,
            max_output_tokens: 1000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(response.status).json({
        error: "Gemini request failed",
        details: data?.error?.message || "Unknown Gemini error"
      });
    }

    const reply =
      data?.output_text ||
      data?.steps
        ?.filter(step => step.type === "model_output")
        ?.flatMap(step => step.content || [])
        ?.filter(item => item.type === "text")
        ?.map(item => item.text)
        ?.join("")
        ?.trim();

    if (!reply) {
      console.error("Empty Gemini response:", data);

      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error("NOVA server error:", error);

    return res.status(500).json({
      error: "NOVA server error",
      details: error.message
    });
  }
}
