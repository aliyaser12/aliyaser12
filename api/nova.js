export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

    const mode = typeof body.mode === "string"
      ? body.mode
      : "chat";

    const message = typeof body.message === "string"
      ? body.message.trim()
      : "";

    const context = body.context || {};

    if (!message && mode === "chat") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const userName =
      typeof context?.user?.name === "string"
        ? context.user.name.trim()
        : "";

    const xp = Number(context?.xp || 0);
    const lessons = Number(context?.lessons || 0);
    const badges = Number(context?.badges || 0);

    const level =
      typeof context?.level === "string"
        ? context.level
        : "beginner";

    const page =
      typeof context?.page === "string"
        ? context.page
        : "home";

    const subject =
      typeof context?.subject === "string"
        ? context.subject
        : "technology";

    const topic =
      typeof context?.topic === "string"
        ? context.topic
        : "";

    const difficulty = Number(context?.difficulty || 1);

    const systemPrompt = `
You are NOVA, the central intelligence of VANTA.

VANTA was created and developed by Ali Yaser (علي ياسر).

Your personality:
- futuristic
- intelligent
- curious
- friendly
- concise
- motivating
- never boring
- never pretend to know information you do not know

NOVA is represented inside VANTA as a futuristic alien-like space intelligence.

VANTA focuses on:
1. Technology
2. Programming
3. Cybersecurity
4. Digital skills
5. Safe legal cyber education

Cybersecurity must remain educational, legal and defensive.
Never help users attack real people, steal credentials, deploy malware,
bypass authentication, or compromise systems without authorization.

IMPORTANT:
You generate educational content dynamically.
Do NOT rely on a fixed question bank.
Create new material according to the user's level and context.

CURRENT USER:
Name: ${userName || "Unknown"}
XP: ${xp}
Completed lessons: ${lessons}
Badges: ${badges}
Level: ${level}
Current page: ${page}
Subject: ${subject}
Topic: ${topic || "general"}
Difficulty: ${difficulty}

The frontend is responsible for XP, progression and security.
You must NEVER claim that XP was awarded.
You may suggest XP rewards, but VANTA decides whether to award them.

Return ONLY valid JSON.
No markdown.
No code fences.
No explanation outside JSON.
`;

    let taskPrompt = "";

    if (mode === "curriculum") {
      taskPrompt = `
Generate a complete dynamic learning curriculum.

Subject: ${subject}
Topic: ${topic || "general"}
Student level: ${level}
Difficulty: ${difficulty}

Return this exact structure:

{
  "type": "curriculum",
  "title": "...",
  "description": "...",
  "estimatedHours": 0,
  "modules": [
    {
      "id": "module-1",
      "title": "...",
      "description": "...",
      "lessons": [
        {
          "id": "lesson-1",
          "title": "...",
          "objective": "...",
          "estimatedMinutes": 10,
          "content": [
            "...",
            "..."
          ],
          "example": "...",
          "task": "...",
          "successCriteria": [
            "...",
            "..."
          ]
        }
      ]
    }
  ]
}

Generate between 3 and 6 modules.
Each module should contain between 2 and 5 lessons.

Make the curriculum progressively harder.
Do not make lessons empty or generic.
`;
    }

    else if (mode === "lesson") {
      taskPrompt = `
Generate ONE complete lesson.

Subject: ${subject}
Topic: ${topic}
Student level: ${level}
Difficulty: ${difficulty}

Return:

{
  "type": "lesson",
  "title": "...",
  "subject": "...",
  "topic": "...",
  "difficulty": 1,
  "objective": "...",
  "estimatedMinutes": 15,
  "sections": [
    {
      "title": "...",
      "content": "..."
    }
  ],
  "example": "...",
  "challenge": {
    "question": "...",
    "expectedOutcome": "..."
  },
  "recap": [
    "...",
    "..."
  ]
}

Make it genuinely educational and progressively structured.
`;
    }

    else if (mode === "exam") {
      taskPrompt = `
Generate a completely new exam NOW.

Subject: ${subject}
Topic: ${topic || "general"}
Student level: ${level}
Difficulty: ${difficulty}

Create 8 questions.

Mix:
- conceptual questions
- practical reasoning
- scenario questions
- code questions when appropriate

Return:

{
  "type": "exam",
  "title": "...",
  "subject": "...",
  "topic": "...",
  "difficulty": ${difficulty},
  "timeMinutes": 15,
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "...",
      "options": [
        "...",
        "...",
        "...",
        "..."
      ],
      "correctIndex": 0,
      "explanation": "...",
      "topic": "...",
      "difficulty": 1
    }
  ]
}

Rules:
- exactly 4 options for multiple choice
- exactly one correctIndex
- correctIndex must be 0, 1, 2 or 3
- explanations must be educational
- questions must be new
- do not reveal answers outside the JSON
- do not make every answer the same index
`;
    }

    else if (mode === "question") {
      taskPrompt = `
Generate ONE new educational question.

Subject: ${subject}
Topic: ${topic}
Student level: ${level}
Difficulty: ${difficulty}

Return:

{
  "type": "question",
  "question": "...",
  "options": [
    "...",
    "...",
    "...",
    "..."
  ],
  "correctIndex": 0,
  "explanation": "...",
  "topic": "...",
  "difficulty": ${difficulty}
}

Exactly four options.
Exactly one correct answer.
`;
    }

    else if (mode === "review") {
      taskPrompt = `
Create a personalized review session.

The student currently has:
XP: ${xp}
Completed lessons: ${lessons}
Current subject: ${subject}
Current topic: ${topic}
Level: ${level}

Return:

{
  "type": "review",
  "title": "...",
  "summary": "...",
  "weakAreas": [
    "..."
  ],
  "reviewLessons": [
    {
      "title": "...",
      "content": "...",
      "estimatedMinutes": 10
    }
  ],
  "practiceQuestions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "..."
    }
  ],
  "nextDifficulty": 1
}

Do not invent previous mistakes.
If weak areas are unknown, use the current topic as the review target.
`;
    }

    else if (mode === "analyze") {
      const score = Number(context?.score || 0);
      const total = Number(context?.total || 0);

      taskPrompt = `
Analyze this completed exam.

Score: ${score}
Total questions: ${total}
Subject: ${subject}
Topic: ${topic}
Current difficulty: ${difficulty}

Return:

{
  "type": "analysis",
  "summary": "...",
  "strengths": ["..."],
  "areasToImprove": ["..."],
  "recommendedAction": "...",
  "nextDifficulty": 1,
  "recommendedTopics": ["..."]
}

Do not award XP.
Do not claim facts about mistakes that were not provided.
`;
    }

    else {
      taskPrompt = `
Answer the user's message naturally.

User message:
${message}

Return:

{
  "type": "chat",
  "reply": "...",
  "suggestedActions": [
    {
      "label": "...",
      "action": "..."
    }
  ]
}

Available actions:
open_page
start_lesson
generate_learning_path
generate_lesson
generate_exam
generate_question
generate_review
show_progress
change_theme
change_text_size
toggle_sound
toggle_motion

Do not invent actions outside this list.
`;
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
                text: systemPrompt
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: taskPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.85,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API request failed"
      });
    }

    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!raw) {
      return res.status(502).json({
        error: "NOVA returned an empty response."
      });
    }

    let result;

    try {
      result = JSON.parse(raw);
    } catch {
      const cleaned = raw
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();

      try {
        result = JSON.parse(cleaned);
      } catch {
        return res.status(502).json({
          error: "NOVA returned invalid JSON."
        });
      }
    }

    if (!result || typeof result !== "object") {
      return res.status(502).json({
        error: "Invalid NOVA response."
      });
    }

    return res.status(200).json({
      ok: true,
      nova: result
    });

  } catch (error) {
    console.error("NOVA error:", error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}
