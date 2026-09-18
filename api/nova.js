/* =========================================================
   VANTA — NOVA CORE
   Firebase Auth + Supabase Memory + Gemini
   ========================================================= */

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || "vanta-9c0bb";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://mknbfymmwuesjffbmkmu.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.1-flash-lite";

/* =========================================================
   BASIC RESPONSE
   ========================================================= */

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

  return res.json(data);

}

/* =========================================================
   METHOD
   ========================================================= */

export default async function handler(req, res) {

  if (req.method !== "POST") {

    return json(res, 405, {
      error: "Method not allowed."
    });

  }

  try {

    if (!GEMINI_API_KEY) {

      return json(res, 500, {
        error:
          "GEMINI_API_KEY is missing in Vercel."
      });

    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {

      return json(res, 500, {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is missing in Vercel."
      });

    }

    const token =
      extractBearerToken(
        req.headers.authorization
      );

    if (!token) {

      return json(res, 401, {
        error:
          "Please sign in to use NOVA."
      });

    }

    /*
     * Firebase token verification.
     */

    const firebaseUser =
      await verifyFirebaseToken(token);

    if (!firebaseUser) {

      return json(res, 401, {
        error:
          "Invalid or expired Firebase session."
      });

    }

    const body =
      req.body || {};

    const action =
      String(
        body.action || "chat"
      );

    const message =
      String(
        body.message || ""
      );

    const context =
      body.context || {};

    const extra =
      body.extra || {};

    /*
     * Load persistent student memory.
     */

    const memory =
      await loadMemory(
        firebaseUser.uid,
        firebaseUser.name ||
        context?.student?.name ||
        ""
      );

    /*
     * Normalize memory before giving it
     * to the model.
     */

    const normalized =
      normalizeMemory(memory);

    /*
     * Route action.
     */

    const result =
      await routeAction({
        action,
        message,
        context,
        extra,
        memory: normalized,
        user: firebaseUser
      });

    /*
     * Save memory changes.
     */

    if (result.memoryPatch) {

      const nextMemory =
        mergeMemory(
          normalized,
          result.memoryPatch
        );

      await saveMemory(
        firebaseUser.uid,
        nextMemory
      );

      result.memory =
        nextMemory;

      delete result.memoryPatch;

    }

    /*
     * Always expose compact memory
     * for the frontend.
     */

    if (!result.memory) {

      result.memory =
        normalized;

    }

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

    return json(
      res,
      500,
      {
        error:
          error?.message ||
          "NOVA encountered an unexpected error."
      }
    );

  }

}

/* =========================================================
   FIREBASE AUTH
   ========================================================= */

/*
 * Firebase Web ID tokens are JWTs.
 *
 * We verify:
 * - signature
 * - issuer
 * - audience
 * - expiration
 *
 * Google's public certificate endpoint is used.
 */

let firebaseKeysCache = null;
let firebaseKeysExpiry = 0;

async function verifyFirebaseToken(token) {

  const parts =
    token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const header =
    decodeBase64Url(
      parts[0]
    );

  const payload =
    decodeBase64Url(
      parts[1]
    );

  if (!header || !payload) {
    return null;
  }

  if (
    header.alg !== "RS256" ||
    !header.kid
  ) {

    return null;

  }

  const now =
    Math.floor(
      Date.now() / 1000
    );

  if (
    !payload.exp ||
    payload.exp < now
  ) {

    return null;

  }

  if (
    payload.iss !==
    `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
  ) {

    return null;

  }

  if (
    payload.aud !==
    FIREBASE_PROJECT_ID
  ) {

    return null;

  }

  const keys =
    await getFirebaseKeys();

  const key =
    keys[header.kid];

  if (!key) {
    return null;
  }

  const crypto =
    await import("node:crypto");

  const verifier =
    crypto.createVerify("RSA-SHA256");

  verifier.update(
    `${parts[0]}.${parts[1]}`
  );

  verifier.end();

  const valid =
    verifier.verify(
      key,
      base64UrlToBuffer(
        parts[2]
      )
    );

  if (!valid) {
    return null;
  }

  return {
    uid:
      payload.user_id ||
      payload.sub,

    email:
      payload.email ||
      "",

    name:
      payload.name ||
      "",

    picture:
      payload.picture ||
      "",

    emailVerified:
      Boolean(
        payload.email_verified
      )
  };

}

async function getFirebaseKeys() {

  const now =
    Date.now();

  if (
    firebaseKeysCache &&
    now < firebaseKeysExpiry
  ) {

    return firebaseKeysCache;

  }

  const response =
    await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );

  if (!response.ok) {

    throw new Error(
      "Could not retrieve Firebase verification keys."
    );

  }

  firebaseKeysCache =
    await response.json();

  const cacheControl =
    response.headers.get(
      "cache-control"
    ) || "";

  const match =
    cacheControl.match(
      /max-age=(\d+)/
    );

  const maxAge =
    match
      ? Number(match[1]) * 1000
      : 3600000;

  firebaseKeysExpiry =
    now + maxAge;

  return firebaseKeysCache;

}

function extractBearerToken(
  authorization
) {

  if (
    typeof authorization !==
    "string"
  ) {

    return null;

  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return match
    ? match[1].trim()
    : null;

}

function decodeBase64Url(value) {

  try {

    return JSON.parse(
      Buffer
        .from(
          value
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
          "base64"
        )
        .toString("utf8")
    );

  } catch {

    return null;

  }

}

function base64UrlToBuffer(value) {

  return Buffer.from(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
    "base64"
  );

}

/* =========================================================
   SUPABASE
   ========================================================= */

async function supabaseRequest(
  path,
  options = {}
) {

  const response =
    await fetch(
      `${SUPABASE_URL}${path}`,
      {
        ...options,

        headers:{
          "Content-Type":
            "application/json",

          "apikey":
            SUPABASE_SERVICE_ROLE_KEY,

          "Authorization":
            `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

          ...(options.headers || {})
        }
      }
    );

  const text =
    await response.text();

  let data = null;

  try {

    data =
      text
        ? JSON.parse(text)
        : null;

  } catch {

    data=text;

  }

  if (!response.ok) {

    throw new Error(
      `Supabase error ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );

  }

  return data;

}

/* =========================================================
   MEMORY DEFAULT
   ========================================================= */

function defaultMemory(name="") {

  return {

    name,

    level:1,

    xp:0,

    lessons:0,

    badges:[],

    focus:"",

    streak:0,

    study_minutes:0,

    mastery:{},

    recent_scores:[],

    recent_topics:[],

    weak_topics:[],

    strengths:[],

    mistakes:[],

    history:[],

    seen_question_ids:[],

    completed_lessons:[],

    learning_path:[],

    daily_missions:[],

    flashcards:[],

    projects:[],

    challenges:[]

  };

}

/* =========================================================
   NORMALIZE MEMORY
   ========================================================= */

function normalizeMemory(memory) {

  const base =
    defaultMemory(
      memory?.name || ""
    );

  const merged = {

    ...base,

    ...(memory || {})

  };

  const arrayFields = [

    "badges",
    "recent_scores",
    "recent_topics",
    "weak_topics",
    "strengths",
    "mistakes",
    "history",
    "seen_question_ids",
    "completed_lessons",
    "learning_path",
    "daily_missions",
    "flashcards",
    "projects",
    "challenges"

  ];

  for (
    const field of arrayFields
  ) {

    if (!Array.isArray(merged[field])) {

      merged[field] = [];

    }

  }

  if (
    !merged.mastery ||
    typeof merged.mastery !== "object"
  ) {

    merged.mastery={};

  }

  merged.level =
    Number(merged.level) || 1;

  merged.xp =
    Number(merged.xp) || 0;

  merged.lessons =
    Number(merged.lessons) || 0;

  merged.streak =
    Number(merged.streak) || 0;

  merged.study_minutes =
    Number(
      merged.study_minutes
    ) || 0;

  return merged;

}

/* =========================================================
   LOAD MEMORY
   ========================================================= */

async function loadMemory(
  firebaseUid,
  name=""
) {

  const encoded =
    encodeURIComponent(
      firebaseUid
    );

  const rows =
    await supabaseRequest(
      `/rest/v1/student_memory?firebase_uid=eq.${encoded}&select=*`
    );

  if (
    Array.isArray(rows) &&
    rows.length
  ) {

    return rows[0];

  }

  /*
   * If old schema has no firebase_uid,
   * this code deliberately does not connect
   * the Firebase user to a random Supabase user.
   */

  return defaultMemory(name);

}

/* =========================================================
   SAVE MEMORY
   ========================================================= */

async function saveMemory(
  firebaseUid,
  memory
) {

  const payload = {

    firebase_uid:
      firebaseUid,

    name:
      memory.name || "",

    level:
      memory.level,

    xp:
      memory.xp,

    lessons:
      memory.lessons,

    badges:
      memory.badges,

    focus:
      memory.focus,

    streak:
      memory.streak,

    study_minutes:
      memory.study_minutes,

    mastery:
      memory.mastery,

    recent_scores:
      memory.recent_scores,

    recent_topics:
      memory.recent_topics,

    weak_topics:
      memory.weak_topics,

    strengths:
      memory.strengths,

    mistakes:
      memory.mistakes,

    history:
      memory.history,

    seen_question_ids:
      memory.seen_question_ids,

    completed_lessons:
      memory.completed_lessons,

    learning_path:
      memory.learning_path,

    daily_missions:
      memory.daily_missions,

    flashcards:
      memory.flashcards,

    projects:
      memory.projects,

    challenges:
      memory.challenges

  };

  await supabaseRequest(
    `/rest/v1/student_memory?on_conflict=firebase_uid`,
    {
      method:"POST",

      headers:{
        "Prefer":
          "resolution=merge-duplicates,return=minimal"
      },

      body:
        JSON.stringify(payload)

    }
  );

}

/* =========================================================
   MEMORY MERGE
   ========================================================= */

function mergeMemory(
  current,
  patch
) {

  const next =
    normalizeMemory(
      current
    );

  if (!patch) {
    return next;
  }

  const scalarFields = [

    "name",
    "level",
    "xp",
    "lessons",
    "focus",
    "streak",
    "study_minutes"

  ];

  for (
    const field of scalarFields
  ) {

    if (
      patch[field] !== undefined
    ) {

      next[field] =
        patch[field];

    }

  }

  const arrayFields = [

    "badges",
    "recent_scores",
    "recent_topics",
    "weak_topics",
    "strengths",
    "mistakes",
    "history",
    "seen_question_ids",
    "completed_lessons",
    "learning_path",
    "daily_missions",
    "flashcards",
    "projects",
    "challenges"

  ];

  for (
    const field of arrayFields
  ) {

    if (
      Array.isArray(
        patch[field]
      )
    ) {

      next[field] =
        patch[field];

    }

  }

  if (
    patch.mastery &&
    typeof patch.mastery ===
    "object"
  ) {

    next.mastery = {

      ...next.mastery,

      ...patch.mastery

    };

  }

  return normalizeMemory(next);

}

/* =========================================================
   ACTION ROUTER
   ========================================================= */

async function routeAction({
  action,
  message,
  context,
  extra,
  memory,
  user
}) {

  switch(action){

    case "chat":

      return await novaChat(
        message,
        context,
        memory,
        user
      );

    case "generate_learning_path":

      return await generateLearningPath(
        message,
        memory,
        context
      );

    case "generate_lesson":

      return await generateLesson(
        message,
        memory,
        context
      );

    case "generate_exam":

      return await generateExam(
        message,
        memory,
        context,
        extra
      );

    case "generate_question":

      return await generateQuestion(
        message,
        memory,
        context
      );

    case "generate_review":

      return await generateReview(
        message,
        memory,
        context
      );

    case "analyze_result":

      return await analyzeResult(
        message,
        memory,
        context,
        extra
      );

    case "show_progress":

      return showProgress(
        memory
      );

    case "plan_day":

      return await planDay(
        message,
        memory,
        context
      );

    case "explain":

      return await explainTopic(
        message,
        memory,
        context
      );

    case "hint":

      return await novaHint(
        message,
        memory,
        context
      );

    case "check_answer":

      return await checkAnswer(
        message,
        memory,
        context,
        extra
      );

    case "generate_flashcards":

      return await generateFlashcards(
        message,
        memory,
        context
      );

    case "generate_project":

      return await generateProject(
        message,
        memory,
        context
      );

    case "generate_challenge":

      return await generateChallenge(
        message,
        memory,
        context
      );

    case "build_curriculum":

      return await buildCurriculum(
        message,
        memory,
        context
      );

    case "web_search":

      return await webSearch(
        message
      );

    default:

      return await novaChat(
        message,
        context,
        memory,
        user
      );

  }

}

/* =========================================================
   NOVA PERSONALITY
   ========================================================= */

const NOVA_SYSTEM = `

You are NOVA, the core intelligence of VANTA.

You are not a generic chatbot.

You are an adaptive educational AI companion.

Your job is to help the student learn deeply.

VANTA focuses on:

Programming
Cybersecurity
Technology
Artificial Intelligence
Networking
Linux
Web development
Algorithms
Databases
Cloud
Computer science
Modern technology

You remember the student's learning history.

You use:

mastery
mistakes
weak topics
strengths
recent scores
recent topics
learning path
completed lessons
seen questions

to personalize future learning.

Never pretend that a static question is dynamically personalized
if it is not.

When generating educational material:

- teach clearly
- adapt difficulty
- avoid unnecessary fluff
- encourage reasoning
- test understanding
- identify misconceptions
- create new material
- avoid repeating seen questions
- connect new concepts to previous weaknesses
- use Arabic when the student speaks Arabic
- use English technical terms when useful

Cybersecurity content must remain educational,
defensive, legal, and safe.

Do not provide operational instructions for harming,
breaking into, stealing from, or attacking real systems.

NOVA personality:

calm
intelligent
slightly mysterious
confident
protective
occasionally intimidating
never annoying

NOVA is represented visually as a fictional symbiote-like
monster inside VANTA, but the educational content remains
professional and useful.

`;

function memoryPrompt(memory) {

  return `

STUDENT MEMORY:

Name:
${memory.name || "Unknown"}

Level:
${memory.level}

XP:
${memory.xp}

Completed lessons:
${memory.lessons}

Streak:
${memory.streak}

Focus:
${memory.focus || "Not defined"}

Mastery:
${JSON.stringify(memory.mastery)}

Weak topics:
${JSON.stringify(memory.weak_topics)}

Strengths:
${JSON.stringify(memory.strengths)}

Recent scores:
${JSON.stringify(memory.recent_scores)}

Recent topics:
${JSON.stringify(memory.recent_topics)}

Known mistakes:
${JSON.stringify(memory.mistakes)}

Completed lessons:
${JSON.stringify(memory.completed_lessons)}

Learning path:
${JSON.stringify(memory.learning_path)}

Seen question IDs:
${JSON.stringify(
  memory.seen_question_ids.slice(-100)
)}

`;

}

/* =========================================================
   GEMINI
   ========================================================= */

async function gemini(
  system,
  prompt,
  schema = null
) {

  const contents = [

    {
      role:"user",
      parts:[
        {
          text:
            `${system}\n\n${prompt}`
        }
      ]
    }

  ];

  const generationConfig = {

    temperature:.85,

    topP:.95,

    maxOutputTokens:12000

  };

  if(schema){

    generationConfig.responseMimeType =
      "application/json";

    generationConfig.responseSchema =
      schema;

  }

  const response =
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method:"POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({

            contents,

            generationConfig

          })

      }
    );

  const data =
    await response
      .json()
      .catch(
        ()=>({})
      );

  if(!response.ok){

    throw new Error(
      data?.error?.message ||
      "Gemini request failed."
    );

  }

  const text =
    data?.candidates?.[0]
      ?.content?.parts
      ?.map(
        part=>part.text || ""
      )
      .join("")
      .trim();

  if(!text){

    throw new Error(
      "NOVA received an empty AI response."
    );

  }

  if(schema){

    return parseJSON(
      text
    );

  }

  return text;

}

/* =========================================================
   JSON PARSER
   ========================================================= */

function parseJSON(text){

  try{

    return JSON.parse(text);

  }catch{}

  const fenced =
    text.match(
      /```(?:json)?\s*([\s\S]*?)```/i
    );

  if(fenced){

    try{

      return JSON.parse(
        fenced[1].trim()
      );

    }catch{}

  }

  const start =
    text.indexOf("{");

  const end =
    text.lastIndexOf("}");

  if(
    start !== -1 &&
    end > start
  ){

    try{

      return JSON.parse(
        text.slice(
          start,
          end+1
        )
      );

    }catch{}

  }

  throw new Error(
    "NOVA generated invalid JSON."
  );

}

/* =========================================================
   CHAT
   ========================================================= */

async function novaChat(
  message,
  context,
  memory,
  user
) {

  const prompt = `

${memoryPrompt(memory)}

CURRENT PAGE:
${context?.page || "home"}

STUDENT MESSAGE:
${message}

Respond naturally in Arabic if the student speaks Arabic.

Do not dump the student's memory.

Answer the actual request.

If the request indicates a learning goal,
remember the useful information through memoryPatch.

`;

  const data =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      chatSchema
    );

  return {

    answer:
      data.answer || "",

    memoryPatch:
      cleanMemoryPatch(
        data.memoryPatch
      )

  };

}

/* =========================================================
   LEARNING PATH
   ========================================================= */

async function generateLearningPath(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

USER GOAL:
${message}

Create a personalized learning path.

Use the student's weak topics.

Do not create a generic path.

Return 8-12 stages.

Each stage must have:

title
topic
description
difficulty
estimated_minutes
reason

`;

  const data =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      learningPathSchema
    );

  const path =
    data.learningPath || {};

  return {

    learning_path:
      path,

    memoryPatch:{

      focus:
        path.goal ||
        memory.focus,

      learning_path:
        path.steps ||
        []

    }

  };

}

/* =========================================================
   LESSON
   ========================================================= */

async function generateLesson(
  message,
  memory,
  context
) {

  const topic =
    extractTopic(
      message
    );

  const prompt = `

${memoryPrompt(memory)}

REQUEST:
${message}

TOPIC:
${topic}

Create a completely new lesson.

The lesson must be adapted to:

- level ${memory.level}
- mastery
- weaknesses
- mistakes
- previous topics

Do not make it a generic article.

Structure:

title
topic
difficulty
estimated_minutes
introduction
objectives
sections
checkpoint_questions
final_task

Every section should teach something useful.

Checkpoint questions must test reasoning.

`;

  const lesson =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      lessonSchema
    );

  return {

    lesson,

    memoryPatch:{

      recent_topics:
        pushLimited(
          memory.recent_topics,
          topic,
          20
        )

    }

  };

}

/* =========================================================
   EXAM
   ========================================================= */

async function generateExam(
  message,
  memory,
  context,
  extra
) {

  const count =
    clamp(
      Number(
        extra?.exam?.count ||
        10
      ),
      5,
      20
    );

  const weak =
    memory.weak_topics
      .slice(0,8);

  const prompt = `

${memoryPrompt(memory)}

REQUEST:
${message}

Generate ${count} completely NEW adaptive exam questions.

Difficulty must adapt to the student's mastery.

Weak topics:
${JSON.stringify(weak)}

Avoid all seen question IDs.

Each question must contain:

id
topic
difficulty
question
options
correctIndex
explanation

Exactly 4 options.

Exactly 1 correct answer.

Questions should test understanding,
not merely wording.

Return JSON only.

`;

  const data =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      examSchema(count)
    );

  const questions =
    validateQuestions(
      data.questions,
      memory
    );

  return {

    exam:{

      title:
        "NOVA Adaptive Exam",

      questions

    },

    memoryPatch:{

      recent_topics:
        pushLimited(
          memory.recent_topics,
          ...questions.map(
            q=>q.topic
          ),
          20
        ),

      seen_question_ids:
        pushLimited(
          memory.seen_question_ids,
          ...questions.map(
            q=>q.id
          ),
          300
        )

    }

  };

}

/* =========================================================
   SINGLE QUESTION
   ========================================================= */

async function generateQuestion(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

Create ONE new question.

Request:
${message}

It must be suitable for level ${memory.level}.

Avoid these IDs:
${JSON.stringify(
  memory.seen_question_ids.slice(-50)
)}

Return:

id
topic
difficulty
question
options
correctIndex
explanation

Exactly four options.

`;

  const question =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      questionSchema
    );

  return {

    question,

    memoryPatch:{

      seen_question_ids:
        pushLimited(
          memory.seen_question_ids,
          question.id,
          300
        )

    }

  };

}

/* =========================================================
   REVIEW
   ========================================================= */

async function generateReview(
  message,
  memory,
  context
) {

  const weak =
    memory.weak_topics;

  const mistakes =
    memory.mistakes.slice(-15);

  const prompt = `

${memoryPrompt(memory)}

Create a focused review session.

Focus on concepts that need reinforcement.

Weak topics:
${JSON.stringify(weak)}

Recent mistakes:
${JSON.stringify(mistakes)}

Create:

title
why_review
concepts
questions
mini_task

Make it different from previous reviews.

`;

  const review =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      reviewSchema
    );

  return {

    review

  };

}

/* =========================================================
   RESULT ANALYSIS
   ========================================================= */

async function analyzeResult(
  message,
  memory,
  context,
  extra
) {

  const result =
    extra?.result ||
    {};

  const score =
    Number(
      result.score || 0
    );

  const prompt = `

${memoryPrompt(memory)}

RESULT:
${JSON.stringify(result)}

Analyze the student's performance.

Identify:

- strong topics
- weak topics
- misconceptions
- next recommended topic
- difficulty adjustment
- review needs
- mastery changes
- mistake patterns

Do not simply repeat the score.

`;

  const analysis =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      analysisSchema
    );

  const nextMastery =
    mergeMastery(
      memory.mastery,
      analysis.masteryUpdates
    );

  const mistakes =
    Array.isArray(
      analysis.mistakes
    )
      ? analysis.mistakes
      : [];

  const weakTopics =
    Array.isArray(
      analysis.weakTopics
    )
      ? analysis.weakTopics
      : memory.weak_topics;

  const strengths =
    Array.isArray(
      analysis.strengths
    )
      ? analysis.strengths
      : memory.strengths;

  return {

    analysis:

      analysis.summary ||
      "تم تحليل الأداء.",

    details:
      analysis,

    memoryPatch:{

      mastery:
        nextMastery,

      weak_topics:
        weakTopics,

      strengths:
        strengths,

      mistakes:
        pushObjects(
          memory.mistakes,
          mistakes,
          100
        ),

      recent_scores:
        pushLimited(
          memory.recent_scores,
          score,
          30
        ),

      recent_topics:
        pushLimited(
          memory.recent_topics,
          ...(analysis.topics || []),
          30
        )

    }

  };

}

/* =========================================================
   PROGRESS
   ========================================================= */

function showProgress(memory){

  const mastery =
    Object.entries(
      memory.mastery || {}
    );

  return {

    progress:{

      level:
        memory.level,

      xp:
        memory.xp,

      lessons:
        memory.lessons,

      streak:
        memory.streak,

      studyMinutes:
        memory.study_minutes,

      mastery,

      weakTopics:
        memory.weak_topics,

      strengths:
        memory.strengths,

      recentScores:
        memory.recent_scores

    }

  };

}

/* =========================================================
   DAILY PLAN
   ========================================================= */

async function planDay(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

Create a realistic study plan for today.

User request:
${message}

Use:

weak topics
mastery
recent mistakes
current level
learning path

Return 3-6 missions.

Each mission:

title
type
topic
minutes
objective
xp

`;

  const plan =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      dayPlanSchema
    );

  return {

    plan,

    memoryPatch:{

      daily_missions:
        plan.missions || []

    }

  };

}

/* =========================================================
   EXPLAIN
   ========================================================= */

async function explainTopic(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

Explain this:

${message}

The student level is ${memory.level}.

Teach progressively.

Use examples.

Then give one tiny check-for-understanding question.

`;

  const answer =
    await gemini(
      NOVA_SYSTEM,
      prompt
    );

  return {

    answer

  };

}

/* =========================================================
   HINT
   ========================================================= */

async function novaHint(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

The student needs a hint for:

${message}

Give a hint, NOT the full answer.

Do not solve the problem completely.

`;

  const hint =
    await gemini(
      NOVA_SYSTEM,
      prompt
    );

  return {

    hint

  };

}

/* =========================================================
   CHECK ANSWER
   ========================================================= */

async function checkAnswer(
  message,
  memory,
  context,
  extra
) {

  const prompt = `

${memoryPrompt(memory)}

QUESTION:
${extra?.question || ""}

STUDENT ANSWER:
${extra?.answer || message}

Evaluate the answer.

Explain:

correctness
reason
misconception
next step

If wrong, teach without shaming.

`;

  const result =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      answerCheckSchema
    );

  const topic =
    extra?.topic ||
    "General";

  const mastery =
    Number(
      memory.mastery?.[topic] ||
      0
    );

  let updatedMastery =
    mastery;

  if(result.correct){

    updatedMastery =
      Math.min(
        100,
        mastery + 4
      );

  }else{

    updatedMastery =
      Math.max(
        0,
        mastery - 2
      );

  }

  return {

    result,

    memoryPatch:{

      mastery:{

        [topic]:
          updatedMastery

      },

      mistakes:
        result.correct
          ? memory.mistakes
          : pushLimited(
              memory.mistakes,
              {
                topic,
                answer:
                  extra?.answer ||
                  message,
                reason:
                  result.reason || "",
                timestamp:
                  new Date().toISOString()
              },
              100
            )

    }

  };

}

/* =========================================================
   FLASHCARDS
   ========================================================= */

async function generateFlashcards(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

Create 8-12 new flashcards.

Topic:
${message}

Focus on weak areas.

Each card:

id
front
back
topic
difficulty

Avoid duplicate concepts where possible.

`;

  const data =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      flashcardSchema
    );

  const cards =
    data.cards || [];

  return {

    flashcards:
      cards,

    memoryPatch:{

      flashcards:
        [
          ...memory.flashcards,
          ...cards
        ].slice(-200)

    }

  };

}

/* =========================================================
   PROJECT
   ========================================================= */

async function generateProject(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

Create a practical educational project.

Request:
${message}

The project should match level ${memory.level}.

Return:

title
goal
skills
requirements
steps
milestones
stretch_goals
evaluation

`;

  const project =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      projectSchema
    );

  return {

    project,

    memoryPatch:{

      projects:
        pushLimited(
          memory.projects,
          project,
          30
        )

    }

  };

}

/* =========================================================
   CHALLENGE
   ========================================================= */

async function generateChallenge(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

Create a new educational challenge.

Request:
${message}

Difficulty:
adapt to level ${memory.level}

The challenge must be legal and defensive.

Cybersecurity challenges may cover:

hashing
password security
phishing awareness
networking
authentication
web security concepts
log analysis
secure coding
incident response
Linux concepts

Do not provide instructions for attacking real systems.

Return:

title
category
difficulty
description
objective
scenario
tasks
hints
solution_explanation

`;

  const challenge =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      challengeSchema
    );

  return {

    challenge,

    memoryPatch:{

      challenges:
        pushLimited(
          memory.challenges,
          challenge,
          50
        )

    }

  };

}

/* =========================================================
   CURRICULUM
   ========================================================= */

async function buildCurriculum(
  message,
  memory,
  context
) {

  const prompt = `

${memoryPrompt(memory)}

Build a complete curriculum.

Request:
${message}

The curriculum must adapt to:

level
mastery
weaknesses
strengths
mistakes
goal

Include:

units
lessons
practice
reviews
exams
projects
milestones

Do not make it generic.

`;

  const curriculum =
    await gemini(
      NOVA_SYSTEM,
      prompt,
      curriculumSchema
    );

  return {

    curriculum,

    memoryPatch:{

      learning_path:
        curriculum.units || []

    }

  };

}

/* =========================================================
   WEB SEARCH
   ========================================================= */

async function webSearch(
  message
) {

  const searchUrl =
    process.env.SEARCH_API_URL;

  const searchKey =
    process.env.SEARCH_API_KEY;

  if(
    !searchUrl ||
    !searchKey
  ){

    return {

      answer:
        "NOVA لا تملك اتصال بحث خارجي مفعّل حاليًا. استخدم المصادر الموجودة في VANTA أو أضف Search API إلى Vercel."

    };

  }

  const response =
    await fetch(
      searchUrl,
      {
        method:"POST",

        headers:{
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${searchKey}`
        },

        body:
          JSON.stringify({
            query:message
          })

      }
    );

  if(!response.ok){

    throw new Error(
      "External search service failed."
    );

  }

  const results =
    await response.json();

  return {

    results

  };

}

/* =========================================================
   ADAPTIVE ENGINE
   ========================================================= */

function adaptiveDifficulty(
  memory
) {

  const mastery =
    Object.values(
      memory.mastery || {}
    );

  if(!mastery.length){

    return 1;

  }

  const avg =
    mastery.reduce(
      (a,b)=>a+Number(b||0),
      0
    ) /
    mastery.length;

  if(avg < 30){
    return 1;
  }

  if(avg < 50){
    return 2;
  }

  if(avg < 70){
    return 3;
  }

  if(avg < 85){
    return 4;
  }

  return 5;

}

/* =========================================================
   MEMORY HELPERS
   ========================================================= */

function cleanMemoryPatch(
  patch
) {

  if(
    !patch ||
    typeof patch !== "object"
  ){

    return {};

  }

  const allowed = [

    "name",
    "level",
    "xp",
    "lessons",
    "focus",
    "streak",
    "study_minutes",
    "mastery",
    "recent_scores",
    "recent_topics",
    "weak_topics",
    "strengths",
    "mistakes",
    "history",
    "seen_question_ids",
    "completed_lessons",
    "learning_path",
    "daily_missions",
    "flashcards",
    "projects",
    "challenges"

  ];

  const clean={};

  for(
    const key of allowed
  ){

    if(
      patch[key] !== undefined
    ){

      clean[key]=
        patch[key];

    }

  }

  return clean;

}

function mergeMastery(
  current,
  updates
) {

  const result = {

    ...(current || {})

  };

  if(
    !updates ||
    typeof updates !== "object"
  ){

    return result;

  }

  for(
    const [topic,value]
    of Object.entries(updates)
  ){

    const n =
      Number(value);

    if(
      Number.isFinite(n)
    ){

      result[topic] =
        clamp(
          Math.round(n),
          0,
          100
        );

    }

  }

  return result;

}

function pushLimited(
  array,
  ...values
) {

  let limit = 50;

  const last =
    values[values.length-1];

  if(
    typeof last === "number" &&
    values.length > 1
  ){

    limit =
      values.pop();

  }

  const base =
    Array.isArray(array)
      ? array
      : [];

  return [
    ...base,
    ...values
  ].slice(-limit);

}

function pushObjects(
  array,
  values,
  limit
) {

  return [

    ...(Array.isArray(array)
      ? array
      : []),

    ...(Array.isArray(values)
      ? values
      : [])

  ].slice(-limit);

}

function clamp(
  value,
  min,
  max
) {

  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );

}

/* =========================================================
   VALIDATION
   ========================================================= */

function validateQuestions(
  questions,
  memory
) {

  if(
    !Array.isArray(questions)
  ){

    return [];

  }

  const seen =
    new Set(
      memory.seen_question_ids
    );

  return questions
    .filter(q=>{

      if(!q) return false;

      if(!q.id) return false;

      if(seen.has(q.id))
        return false;

      if(
        !Array.isArray(q.options) ||
        q.options.length !== 4
      ){

        return false;

      }

      const correct =
        Number(
          q.correctIndex
        );

      if(
        !Number.isInteger(correct) ||
        correct < 0 ||
        correct > 3
      ){

        return false;

      }

      return Boolean(
        q.question
      );

    })
    .map(q=>({

      id:String(q.id),

      topic:
        String(
          q.topic ||
          "General"
        ),

      difficulty:
        String(
          q.difficulty ||
          "adaptive"
        ),

      question:
        String(
          q.question
        ),

      options:
        q.options
          .slice(0,4)
          .map(
            String
          ),

      correctIndex:
        Number(
          q.correctIndex
        ),

      explanation:
        String(
          q.explanation ||
          ""
        )

    }));

}

/* =========================================================
   TOPIC
   ========================================================= */

function extractTopic(
  message
) {

  const text =
    String(
      message || ""
    );

  const known = [

    "Python",
    "JavaScript",
    "Algorithms",
    "Networking",
    "Linux",
    "Cybersecurity",
    "Web Security",
    "Hashing",
    "Artificial Intelligence",
    "Databases",
    "Cloud Computing",
    "HTML",
    "CSS",
    "Programming"

  ];

  const found =
    known.find(
      topic =>
        text
          .toLowerCase()
          .includes(
            topic.toLowerCase()
          )
    );

  return (
    found ||
    text.slice(0,80) ||
    "General"
  );

}

/* =========================================================
   SCHEMAS
   ========================================================= */

const chatSchema = {

  type:"object",

  properties:{

    answer:{
      type:"string"
    },

    memoryPatch:{
      type:"object",

      properties:{

        name:{
          type:"string"
        },

        focus:{
          type:"string"
        },

        level:{
          type:"integer"
        },

        xp:{
          type:"integer"
        },

        lessons:{
          type:"integer"
        },

        streak:{
          type:"integer"
        }

      }

    }

  },

  required:[
    "answer",
    "memoryPatch"
  ]

};

const learningPathSchema = {

  type:"object",

  properties:{

    learningPath:{

      type:"object",

      properties:{

        goal:{
          type:"string"
        },

        reason:{
          type:"string"
        },

        steps:{

          type:"array",

          items:{
            type:"object",

            properties:{

              title:{
                type:"string"
              },

              topic:{
                type:"string"
              },

              description:{
                type:"string"
              },

              difficulty:{
                type:"string"
              },

              estimated_minutes:{
                type:"integer"
              },

              reason:{
                type:"string"
              }

            },

            required:[
              "title",
              "topic",
              "description"
            ]

          }

        }

      },

      required:[
        "goal",
        "steps"
      ]

    }

  },

  required:[
    "learningPath"
  ]

};

const lessonSchema = {

  type:"object",

  properties:{

    title:{
      type:"string"
    },

    topic:{
      type:"string"
    },

    difficulty:{
      type:"string"
    },

    estimated_minutes:{
      type:"integer"
    },

    introduction:{
      type:"string"
    },

    objectives:{
      type:"array",
      items:{
        type:"string"
      }
    },

    sections:{

      type:"array",

      items:{

        type:"object",

        properties:{

          title:{
            type:"string"
          },

          content:{
            type:"string"
          },

          example:{
            type:"string"
          }

        },

        required:[
          "title",
          "content"
        ]

      }

    },

    checkpoint_questions:{

      type:"array",

      items:{
        type:"string"
      }

    },

    final_task:{
      type:"string"
    }

  },

  required:[
    "title",
    "topic",
    "sections"
  ]

};

function questionProperties(){

  return {

    id:{
      type:"string"
    },

    topic:{
      type:"string"
    },

    difficulty:{
      type:"string"
    },

    question:{
      type:"string"
    },

    options:{
      type:"array",
      items:{
        type:"string"
      }
    },

    correctIndex:{
      type:"integer"
    },

    explanation:{
      type:"string"
    }

  };

}

const questionSchema = {

  type:"object",

  properties:
    questionProperties(),

  required:[
    "id",
    "topic",
    "difficulty",
    "question",
    "options",
    "correctIndex",
    "explanation"
  ]

};

function examSchema(count){

  return {

    type:"object",

    properties:{

      questions:{

        type:"array",

        minItems:count,

        maxItems:count,

        items:{

          type:"object",

          properties:
            questionProperties(),

          required:[
            "id",
            "topic",
            "difficulty",
            "question",
            "options",
            "correctIndex",
            "explanation"
          ]

        }

      }

    },

    required:[
      "questions"
    ]

  };

}

const reviewSchema = {

  type:"object",

  properties:{

    title:{
      type:"string"
    },

    why_review:{
      type:"string"
    },

    concepts:{
      type:"array",
      items:{
        type:"string"
      }
    },

    questions:{
      type:"array",
      items:{
        type:"object"
      }
    },

    mini_task:{
      type:"string"
    }

  },

  required:[
    "title",
    "concepts",
    "questions"
  ]

};

const analysisSchema = {

  type:"object",

  properties:{

    summary:{
      type:"string"
    },

    strengths:{
      type:"array",
      items:{
        type:"string"
      }
    },

    weakTopics:{
      type:"array",
      items:{
        type:"string"
      }
    },

    mistakes:{
      type:"array",
      items:{
        type:"object"
      }
    },

    topics:{
      type:"array",
      items:{
        type:"string"
      }
    },

    masteryUpdates:{
      type:"object",
      additionalProperties:{
        type:"number"
      }
    }

  },

  required:[
    "summary",
    "strengths",
    "weakTopics",
    "mistakes",
    "masteryUpdates"
  ]

};

const answerCheckSchema = {

  type:"object",

  properties:{

    correct:{
      type:"boolean"
    },

    reason:{
      type:"string"
    },

    misconception:{
      type:"string"
    },

    nextStep:{
      type:"string"
    }

  },

  required:[
    "correct",
    "reason",
    "nextStep"
  ]

};

const flashcardSchema = {

  type:"object",

  properties:{

    cards:{

      type:"array",

      items:{

        type:"object",

        properties:{

          id:{
            type:"string"
          },

          front:{
            type:"string"
          },

          back:{
            type:"string"
          },

          topic:{
            type:"string"
          },

          difficulty:{
            type:"string"
          }

        },

        required:[
          "id",
          "front",
          "back",
          "topic"
        ]

      }

    }

  },

  required:[
    "cards"
  ]

};

const projectSchema = {

  type:"object",

  properties:{

    title:{
      type:"string"
    },

    goal:{
      type:"string"
    },

    skills:{
      type:"array",
      items:{
        type:"string"
      }
    },

    requirements:{
      type:"array",
      items:{
        type:"string"
      }
    },

    steps:{
      type:"array",
      items:{
        type:"string"
      }
    },

    milestones:{
      type:"array",
      items:{
        type:"string"
      }
    },

    stretch_goals:{
      type:"array",
      items:{
        type:"string"
      }
    },

    evaluation:{
      type:"string"
    }

  },

  required:[
    "title",
    "goal",
    "steps"
  ]

};

const challengeSchema = {

  type:"object",

  properties:{

    title:{
      type:"string"
    },

    category:{
      type:"string"
    },

    difficulty:{
      type:"string"
    },

    description:{
      type:"string"
    },

    objective:{
      type:"string"
    },

    scenario:{
      type:"string"
    },

    tasks:{
      type:"array",
      items:{
        type:"string"
      }
    },

    hints:{
      type:"array",
      items:{
        type:"string"
      }
    },

    solution_explanation:{
      type:"string"
    }

  },

  required:[
    "title",
    "category",
    "description",
    "objective",
    "tasks"
  ]

};

const dayPlanSchema = {

  type:"object",

  properties:{

    title:{
      type:"string"
    },

    missions:{

      type:"array",

      items:{

        type:"object",

        properties:{

          title:{
            type:"string"
          },

          type:{
            type:"string"
          },

          topic:{
            type:"string"
          },

          minutes:{
            type:"integer"
          },

          objective:{
            type:"string"
          },

          xp:{
            type:"integer"
          }

        },

        required:[
          "title",
          "topic",
          "minutes",
          "objective"
        ]

      }

    }

  },

  required:[
    "title",
    "missions"
  ]

};

const curriculumSchema = {

  type:"object",

  properties:{

    title:{
      type:"string"
    },

    goal:{
      type:"string"
    },

    units:{

      type:"array",

      items:{

        type:"object",

        properties:{

          title:{
            type:"string"
          },

          description:{
            type:"string"
          },

          lessons:{
            type:"array",
            items:{
              type:"object"
            }
          }

        },

        required:[
          "title",
          "lessons"
        ]

      }

    }

  },

  required:[
    "title",
    "units"
  ]

};

/* =========================================================
   FINAL MEMORY SAFETY
   ========================================================= */

function limitMemoryArrays(
  memory
) {

  memory.badges =
    memory.badges.slice(-50);

  memory.recent_scores =
    memory.recent_scores.slice(-30);

  memory.recent_topics =
    memory.recent_topics.slice(-30);

  memory.weak_topics =
    memory.weak_topics.slice(0,30);

  memory.strengths =
    memory.strengths.slice(0,30);

  memory.mistakes =
    memory.mistakes.slice(-100);

  memory.history =
    memory.history.slice(-100);

  memory.seen_question_ids =
    memory.seen_question_ids.slice(-300);

  memory.completed_lessons =
    memory.completed_lessons.slice(-200);

  memory.learning_path =
    memory.learning_path.slice(-100);

  memory.daily_missions =
    memory.daily_missions.slice(-30);

  memory.flashcards =
    memory.flashcards.slice(-200);

  memory.projects =
    memory.projects.slice(-30);

  memory.challenges =
    memory.challenges.slice(-50);

  return memory;

}

/* =========================================================
   OVERRIDE NORMALIZATION
   ========================================================= */

const originalNormalizeMemory =
  normalizeMemory;

normalizeMemory = function(memory){

  return limitMemoryArrays(
    originalNormalizeMemory(
      memory
    )
  );

};
