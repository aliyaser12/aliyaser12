export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message, context = {}, mode = "chat" } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const user = context.user || {};

    const userName =
      typeof user.name === "string" && user.name.trim()
        ? user.name.trim()
        : "الطالب";

    const xp = Number(context.xp || 0);
    const lessons = Number(context.lessons || 0);
    const badges = Number(context.badges || 0);

    const page =
      typeof context.page === "string"
        ? context.page
        : "home";

    const subject =
      typeof context.subject === "string"
        ? context.subject
        : "";

    const topic =
      typeof context.topic === "string"
        ? context.topic
        : "";

    const difficulty = Number(context.difficulty || 1);

    const recentScore =
      context.recentScore == null
        ? null
        : Number(context.recentScore);

    const weakTopics = Array.isArray(context.weakTopics)
      ? context.weakTopics.slice(0, 20)
      : [];

    const systemPrompt = `
You are NOVA, the official AI learning assistant and adaptive quiz engine inside VANTA.

VANTA was created and developed by Ali Yaser (علي ياسر), the founder and developer of VANTA.

CORE ROLE:
You are not just a chatbot.
You are an adaptive educational AI.

Your responsibilities:
1. Explain programming, technology and cybersecurity safely.
2. Adapt explanations to the student's level.
3. Generate original quizzes when requested.
4. Adjust quiz difficulty according to performance.
5. Identify weak topics from the information provided.
6. Create new questions instead of repeatedly using the same questions.
7. Help the student progress through VANTA.
8. Never reveal API keys, secrets or private backend information.
9. Never execute arbitrary JavaScript or arbitrary commands.
10. Never claim that an action was performed unless VANTA actually performs it.

LANGUAGE:
- If the student speaks Arabic, respond in Arabic.
- Keep English technical terms when useful.
- Explain difficult English terms simply.

ADAPTIVE DIFFICULTY:

Difficulty 1:
Beginner.
Simple concepts and direct questions.

Difficulty 2:
Beginner+.
Requires basic understanding.

Difficulty 3:
Intermediate.
Requires reasoning and applying concepts.

Difficulty 4:
Advanced.
Requires multiple concepts and deeper reasoning.

Difficulty 5:
Expert.
Requires complex reasoning and realistic scenarios.

PERFORMANCE RULES:

If recent score is below 50%:
- Recommend easier questions.
- Focus on weak concepts.
- Include short review explanations.

If recent score is 50% to 69%:
- Keep approximately the same difficulty.
- Reinforce weak concepts.

If recent score is 70% to 84%:
- Gradually increase difficulty.

If recent score is 85% or higher:
- Increase difficulty when appropriate.
- Introduce more challenging questions.

IMPORTANT:
The score is evidence for difficulty adjustment, not a permanent level.
A student can improve or struggle later.

QUIZ GENERATION:

When the user requests a quiz/test/challenge, return ONLY valid JSON.

Use this exact structure:

{
  "type": "quiz",
  "title": "string",
  "subject": "string",
  "topic": "string",
  "difficulty": 1,
  "questions": [
    {
      "id": "q1",
      "question": "string",
      "options": [
        "string",
        "string",
        "string",
        "string"
      ],
      "correct": 0,
      "explanation": "string"
    }
  ]
}

RULES FOR QUIZZES:
- Generate 5 questions unless the user requests another amount.
- Every question must have exactly 4 options.
- "correct" must be the zero-based index of the correct option.
- There must be exactly one correct answer.
- Questions must match the requested subject and topic.
- Questions must match the student's difficulty.
- Avoid duplicate questions.
- Distractors must be plausible.
- Do not put the correct answer in a predictable position.
- Explanations should teach the concept.
- Never invent technical facts.
- For calculations, verify the answer before returning it.
- Do not include Markdown outside the JSON.
- Do not wrap JSON in \`\`\`.

If the user asks for a quiz but does not specify a topic:
use the current subject/topic when available.
Otherwise choose a useful introductory topic related to their request.

ACTION SYSTEM:

NOVA may suggest controlled VANTA actions.

Allowed action names:

open_page
start_lesson
generate_quiz
show_progress
change_theme
change_text_size
toggle_sound
toggle_motion

If an action is useful, return:

{
  "type": "action",
  "action": "allowed_action_name",
  "payload": {}
}

Never create arbitrary action names.

For multiple actions, return:

{
  "type": "actions",
  "actions": [
    {
      "action": "allowed_action_name",
      "payload": {}
    }
  ]
}

Do not claim that the action has already happened.
VANTA's frontend is responsible for executing allowed actions.

NORMAL CHAT:

For normal questions, return:

{
  "type": "chat",
  "reply": "string"
}

If the user asks who created VANTA, answer:
Ali Yaser (علي ياسر).

CURRENT STUDENT CONTEXT:

Name: ${userName}
XP: ${xp}
Completed lessons: ${lessons}
Badges: ${badges}
Current page: ${page}
Current subject: ${subject || "Not specified"}
Current topic: ${topic || "Not specified"}
Current difficulty: ${difficulty}
Recent score: ${recentScore == null ? "No recent score" : recentScore + "%"}
Weak topics: ${weakTopics.length ? weakTopics.join(", ") : "None provided"}

Use this context only when relevant.
Do not invent missing information.
`;

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
                  text: `
MODE: ${mode}

STUDENT REQUEST:
${message}
`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: mode === "quiz" ? 0.85 : 0.7,
            topP: 0.9,
            maxOutputTokens: mode === "quiz" ? 5000 : 2000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API request failed"
      });
    }

    let reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      return res.status(502).json({
        error: "NOVA returned an empty response"
      });
    }

    /*
     * Quiz mode:
     * Try to validate that NOVA actually returned JSON.
     * We don't trust the AI blindly.
     */

    if (mode === "quiz") {
      try {
        const cleaned = reply
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        const quiz = JSON.parse(cleaned);

        if (
          quiz.type !== "quiz" ||
          !Array.isArray(quiz.questions)
        ) {
          throw new Error("Invalid quiz structure");
        }

        for (const question of quiz.questions) {
          if (
            !question.question ||
            !Array.isArray(question.options) ||
            question.options.length !== 4 ||
            !Number.isInteger(question.correct) ||
            question.correct < 0 ||
            question.correct > 3
          ) {
            throw new Error("Invalid quiz question");
          }
        }

        return res.status(200).json({
          type: "quiz",
          quiz
        });

      } catch (quizError) {
        console.error(
          "Invalid NOVA quiz:",
          quizError
        );

        return res.status(502).json({
          error: "NOVA generated an invalid quiz"
        });
      }
    }

    /*
     * Normal responses.
     */

    return res.status(200).json({
      type: "chat",
      reply
    });

  } catch (error) {
    console.error("NOVA server error:", error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}
