const { z } = require("zod");
const { GoogleGenAI } = require("@google/genai");
const config = require("../config");

let activeModel = config.defaultModel;

// Validation Schemas for Gemini AI Output
const EvaluationSchema = z.object({
  score: z.number().int().min(0).max(10),
  criteria: z.object({
    relevance: z.number().int().min(0).max(2).default(1),
    accuracy: z.number().int().min(0).max(2).default(1),
    clarity: z.number().int().min(0).max(2).default(1),
    depth: z.number().int().min(0).max(2).default(1),
    structure: z.number().int().min(0).max(2).default(1),
    communication: z.number().int().min(0).max(2).default(1)
  }).default({}),
  good: z.string().default("Demonstrated foundational effort."),
  improve: z.string().default("Structure your answer with definition first, followed by a concrete project example."),
  why_this_score: z.string().default("Score is based on criteria rubric calibration."),
  specific_suggestions: z.array(z.string()).default([]),
  missing_points: z.array(z.string()).default([]),
  sample_answer: z.string().default(""),
  filler_words_detected: z.array(z.string()).default([]),
  follow_up_question: z.string().default("")
});

const ReportSchema = z.object({
  final_score: z.number().int().min(0).max(100),
  verdict: z.enum(["Ready", "Almost ready", "Needs practice"]).default("Needs practice"),
  category_scores: z.record(z.string(), z.number()).default({}),
  strengths: z.array(z.string()).min(1).default(["Good foundational understanding."]),
  weaknesses: z.array(z.string()).min(1).default(["Elaborate more on practical application."]),
  seven_day_plan: z.array(z.string()).min(1).default([
    "Day 1: Practice self-introduction pitch focusing on academics and projects.",
    "Day 2: Revise core programming fundamentals and data structures.",
    "Day 3: Write out 2 college projects in the STAR format.",
    "Day 4: Practice rapid conceptual questions on OOPs concepts.",
    "Day 5: Rehearse situational questions on teamwork and deadlines.",
    "Day 6: Conduct a mock timer-based interview to reduce filler words.",
    "Day 7: Full mock round combining HR, Technical, and Situational questions."
  ])
});

// Centralized Gemini Client Cache
let cachedClient = null;
let cachedKey = null;

function getGeminiClient() {
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not configured in backend/.env. Please configure your key.");
    err.status = 500;
    throw err;
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return { ai: cachedClient, apiKey };
}

function createGeminiError(statusCode, clientMessage, originalError, modelName) {
  const err = new Error(clientMessage);
  err.status = statusCode;
  err.details = {
    httpStatus: statusCode,
    model: modelName,
    googleMessage: originalError?.message || clientMessage,
    googleStatus: originalError?.status || statusCode,
    keyConfigured: !!config.geminiApiKey
  };
  return err;
}

/**
 * Robust Gemini API Caller using the official @google/genai SDK
 * with candidate model rotation & recovery
 */
async function callGeminiRaw(prompt, systemInstruction = "") {
  const { ai, apiKey } = getGeminiClient();
  const candidates = [activeModel, ...config.modelCandidates.filter(m => m !== activeModel)];

  for (let i = 0; i < candidates.length; i++) {
    const candidateModel = candidates[i];
    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
          systemInstruction: systemInstruction || undefined
        }
      });

      const rawText = response.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("Empty response received from Gemini.");
      }

      activeModel = candidateModel;
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      return JSON.parse(cleaned);

    } catch (err) {
      let statusCode = err.status || 500;
      let errMsg = err.message || "";
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.error) {
          statusCode = parsed.error.code || statusCode;
          errMsg = parsed.error.message || errMsg;
        }
      } catch (_) {}

      // If model not found (404), rotate to next candidate model
      if (statusCode === 404 || errMsg.toLowerCase().includes("not found")) {
        console.warn(`[AI Service] Model ${candidateModel} returned 404/not found. Trying next candidate...`);
        continue;
      }

      // Format accurate, actionable error messages with proper HTTP status codes
      if (statusCode === 403 && errMsg.includes("free tier is not available for this project")) {
        throw createGeminiError(
          403,
          "Gemini API Error (HTTP 403 Forbidden): The Gemini API free tier is not available for this project. " +
          "To resolve this, either upgrade your project at https://aistudio.google.com/billing or go to https://aistudio.google.com " +
          "and click 'Create API key in new project' using a personal Google account, then paste the new key into backend/.env.",
          err,
          candidateModel
        );
      } else if (statusCode === 403) {
        throw createGeminiError(
          403,
          `Gemini API Error (HTTP 403 Forbidden): Access denied by Google Gemini API. ${errMsg}`,
          err,
          candidateModel
        );
      } else if (statusCode === 400 && (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID"))) {
        throw createGeminiError(
          400,
          "Gemini API Error (HTTP 400 Invalid Key): API key is invalid or unrecognized. Please check GEMINI_API_KEY in backend/.env.",
          err,
          candidateModel
        );
      } else if (statusCode === 401) {
        throw createGeminiError(
          401,
          "Gemini API Error (HTTP 401 Unauthorized): API key is not authorized. Please verify GEMINI_API_KEY in backend/.env.",
          err,
          candidateModel
        );
      } else if (statusCode === 429) {
        throw createGeminiError(
          429,
          "Gemini API rate limit exceeded (HTTP 429). Please wait a moment before trying again.",
          err,
          candidateModel
        );
      } else {
        throw createGeminiError(
          statusCode,
          `Gemini API Error (HTTP ${statusCode}): ${errMsg}`,
          err,
          candidateModel
        );
      }
    }
  }

  const err = new Error("No available Gemini model found. Please verify your Gemini API access in Google AI Studio.");
  err.status = 503;
  throw err;
}

/**
 * 1. Adaptive Interview Question Generator
 */
async function generateQuestion(opts) {
  const {
    role = "Web Developer",
    difficulty = "Entry-level / Junior",
    questionNumber = 1,
    totalQuestions = 5,
    category = "Technical",
    isQuickFire = false,
    companyType = "Product",
    preferredTech = "",
    previousQuestions = [],
    previousAnswers = [],
    resumeSnippet = ""
  } = opts;

  // Question 1 rule: always begin with self-introduction
  if (questionNumber === 1 && !isQuickFire) {
    return {
      question: "Tell me about yourself, your educational background, and what sparked your interest in technology?",
      type: "HR",
      tip: "Give a crisp introduction covering your college, key technical interests, and projects you enjoy building.",
      sample_answer: "I am a first-year B.Tech student passionate about web development and problem solving. Recently, I built a personal portfolio and a mini task app using HTML, CSS, and basic JavaScript. I enjoy learning modern web frameworks and am eager to apply my fundamentals in real projects."
    };
  }

  const systemInstruction = `You are InterviewAce, a professional, rigorous, and friendly interview coach for engineering students and freshers in India.
Target Role: ${role}
Difficulty Level: ${difficulty}
Company Type: ${companyType}
Candidate Preferred Tech: ${preferredTech || "Standard fundamentals"}`;

  const prompt = `Formulate Question #${questionNumber} of ${totalQuestions} for an interview round.
Question Category: ${category}
Is Quick-Fire Question: ${isQuickFire} (If true, ask a short, fundamental 1-line definition question suitable for a 60-second response).
Previous Questions Asked So Far: ${JSON.stringify(previousQuestions)}
Candidate Recent Answer Context: ${JSON.stringify(previousAnswers.slice(-2))}
Candidate Resume & Project Context: ${resumeSnippet ? resumeSnippet.slice(0, 1000) : "None provided"}

CRITICAL RULES:
1. Do NOT repeat previous questions.
2. If Category is "Resume-based", probe specifically into projects or technologies mentioned in the resume context without inventing qualifications.
3. Never ask senior architecture questions (no microservices, Kafka, Redis, or distributed scaling for freshers). Focus strictly on fundamentals: HTML/CSS, basic JS, OOP concepts, SQL, core DSA, or teamwork.
4. Return ONLY a valid JSON object matching this schema:
{
  "question": "The interview question text",
  "type": "${category}",
  "tip": "Short 1-sentence tip on what a strong candidate should emphasize",
  "sample_answer": "A strong, beginner-friendly 2-4 sentence benchmark answer"
}`;

  const rawJson = await callGeminiRaw(prompt, systemInstruction);
  return {
    question: rawJson.question || "Explain a core concept you recently learned in engineering.",
    type: rawJson.type || category,
    tip: rawJson.tip || "Define clearly and offer an example.",
    sample_answer: rawJson.sample_answer || ""
  };
}

/**
 * 2. Real AI 6-Criteria Answer Evaluator
 */
async function evaluateAnswer(opts) {
  const {
    role = "Web Developer",
    difficulty = "Entry-level / Junior",
    question = "",
    questionObj = {},
    candidateAnswer = "",
    answer = "",
    category = "Technical",
    isQuickFire = false,
    resumeSnippet = ""
  } = opts;

  const actualQuestion = question || questionObj.question || "";
  const actualCategory = category || questionObj.type || "Technical";
  const rawAnswer = (candidateAnswer || answer || "").trim();
  const wordCount = rawAnswer ? rawAnswer.split(/\s+/).filter(Boolean).length : 0;

  // Handle skipped or empty answers locally
  if (!rawAnswer || rawAnswer.startsWith("[") || wordCount === 0) {
    return {
      score: 0,
      criteria: {
        relevance: 0,
        accuracy: 0,
        clarity: 0,
        depth: 0,
        structure: 0,
        communication: 0
      },
      good: "None (No response was provided).",
      improve: "In a real interview, never leave a question unanswered. Attempting a fundamental definition gives the interviewer signal.",
      why_this_score: "No substantive answer was provided.",
      specific_suggestions: [
        "State a basic definition of the concept.",
        "Provide an everyday analogy or reference a coursework lab assignment."
      ],
      missing_points: ["A clear direct definition of the core concept.", "An intuitive everyday analogy or college project example."],
      sample_answer: questionObj.sample_answer || "A strong answer starts with a direct definition and gives a simple practical example.",
      filler_words_detected: [],
      follow_up_question: "Would you like to try defining this concept in your own words?",
      capped_score_applied: false
    };
  }

  const systemInstruction = `You are InterviewAce AI, an honest and rubric-calibrated interview evaluator for engineering students and freshers.
Evaluate strictly on fresh-graduate standards. Do NOT award 8+ to vague, generic, or incomplete answers. Judge substance over buzzwords.`;

  const prompt = `Evaluate the candidate's answer to the following interview question.
Role: ${role}
Difficulty: ${difficulty}
Question: "${actualQuestion}"
Question Category: ${actualCategory}
Is Quick-Fire: ${isQuickFire}

Candidate Answer:
"${rawAnswer}"

Word Count: ${wordCount}
Resume/Projects Snippet Context: ${resumeSnippet ? resumeSnippet.slice(0, 800) : "None provided"}

EVALUATE STRICTLY ACROSS 6 CRITERIA (Score each as integer 0, 1, or 2):
1. relevance (0-2): Does the answer directly address the specific question without wandering?
2. accuracy (0-2): Are the technical facts, terminology, and definitions accurate?
3. clarity (0-2): Is the explanation easy to follow and articulated simply?
4. depth (0-2): Does it include key underlying concepts or a concrete project example?
5. structure (0-2): Is there a logical sequence (definition -> explanation -> example)?
6. communication (0-2): Confident, professional tone without excessive fillers or hesitation.

HONEST SCORING RULES:
- If the answer has fewer than 20 words (fewer than 8 for quick-fire), cap total score at 7 maximum.
- Do NOT invent candidate achievements.
- Distinguish factual correctness from speaking style.

Return ONLY a valid JSON object matching this schema:
{
  "score": <total score integer 0-10 based on criteria sum>,
  "criteria": {
    "relevance": <0-2>,
    "accuracy": <0-2>,
    "clarity": <0-2>,
    "depth": <0-2>,
    "structure": <0-2>,
    "communication": <0-2>
  },
  "good": "<1-2 sentences on what the candidate did well>",
  "improve": "<1-2 sentences with concrete, actionable advice for a fresher>",
  "why_this_score": "<1-2 sentences clearly explaining why this score was awarded according to the rubric>",
  "specific_suggestions": [
    "<Specific actionable improvement 1>",
    "<Specific actionable improvement 2>"
  ],
  "missing_points": [
    "<Key concept or detail the candidate missed 1>",
    "<Key concept or detail the candidate missed 2>"
  ],
  "sample_answer": "<A strong, clear 2-4 sentence benchmark answer>",
  "filler_words_detected": ["um", "like"],
  "follow_up_question": "<A relevant 1-sentence follow-up question probing deeper into this topic>"
}`;

  const rawResult = await callGeminiRaw(prompt, systemInstruction);
  const validated = EvaluationSchema.parse(rawResult);

  // Enforce Honest-Scoring Cap in code
  const isShort = isQuickFire ? (wordCount < 8) : (wordCount < 20);
  let finalScore = validated.score;
  let scoreCapped = false;
  let capReason = "";

  if (isShort && finalScore > 7) {
    finalScore = 7;
    scoreCapped = true;
    capReason = isQuickFire
      ? "Score capped at 7 because answer was under 8 words."
      : "Score capped at 7 because answer was under 20 words.";
  }

  return {
    ...validated,
    score: finalScore,
    capped_score_applied: scoreCapped,
    cap_reason: capReason
  };
}

/**
 * 3. Comprehensive Post-Interview Diagnostic & 7-Day Plan
 */
async function generateFinalReport(opts) {
  const {
    role = "Web Developer",
    difficulty = "Entry-level / Junior",
    questionsAndAnswers = []
  } = opts;

  const interviewTranscript = questionsAndAnswers
    .map((qa, i) => `Q${i + 1} (${qa.type}): ${qa.question}\nCandidate Answer: ${qa.answer}\nScore: ${qa.score}/10`)
    .join("\n\n");

  const systemInstruction = `You are InterviewAce AI, synthesizing a full diagnostic assessment and personalized 7-day preparation roadmap for a first-year engineering student.`;

  const prompt = `Analyze this complete interview session:
Target Role: ${role}
Difficulty: ${difficulty}

Full Interview Transcript:
${interviewTranscript}

Provide a comprehensive assessment:
1. Overall score (0-100 scale).
2. Verdict: "Ready" (75-100), "Almost ready" (50-74), or "Needs practice" (<50).
3. Exactly 3 distinct strengths observed in their answers.
4. Exactly 3 actionable areas for improvement.
5. A personalized 7-day revision plan with 1 concrete, actionable 30-minute mini task per day addressing the candidate's actual mistakes in this session.

Return ONLY a valid JSON object matching this schema:
{
  "final_score": <integer 0-100>,
  "verdict": "<Ready|Almost ready|Needs practice>",
  "category_scores": {
    "HR": <average 0-100>,
    "Technical": <average 0-100>,
    "Behavioral": <average 0-100>,
    "Situational": <average 0-100>
  },
  "strengths": [
    "<Strength 1>",
    "<Strength 2>",
    "<Strength 3>"
  ],
  "weaknesses": [
    "<Weakness 1>",
    "<Weakness 2>",
    "<Weakness 3>"
  ],
  "seven_day_plan": [
    "Day 1: <Concrete 30-min revision task>",
    "Day 2: <Concrete 30-min revision task>",
    "Day 3: <Concrete 30-min revision task>",
    "Day 4: <Concrete 30-min revision task>",
    "Day 5: <Concrete 30-min revision task>",
    "Day 6: <Concrete 30-min revision task>",
    "Day 7: <Concrete 30-min revision task>"
  ]
}`;

  const rawResult = await callGeminiRaw(prompt, systemInstruction);
  return ReportSchema.parse(rawResult);
}

/**
 * Test Gemini API connection with a comprehensive, safe probe
 * Checks key configuration, Google Generative Language API authentication,
 * and content generation permissions without leaking credentials.
 */
async function testConnection() {
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    return {
      success: false,
      verified: false,
      keyConfigured: false,
      error: "GEMINI_API_KEY is not configured in backend/.env."
    };
  }

  const maskedKey = apiKey.length > 10
    ? apiKey.slice(0, 7) + "..." + apiKey.slice(-4)
    : "***";

  // Step 1: Probe Google's model catalog endpoint to verify key validity and network reachability
  let modelsListOk = false;
  let availableModels = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      modelsListOk = true;
      availableModels = (listData.models || []).slice(0, 5).map(m => m.name.replace("models/", ""));
    }
  } catch (netErr) {
    return {
      success: false,
      verified: false,
      keyConfigured: true,
      maskedKey,
      error: `Network error connecting to Gemini API: ${netErr.message}`
    };
  }

  // Step 2: Probe generation with activeModel using @google/genai SDK
  try {
    const prompt = "Respond with JSON: {\"status\": \"ok\", \"verified\": true}";
    const raw = await callGeminiRaw(prompt);
    return {
      success: true,
      verified: true,
      keyConfigured: true,
      maskedKey,
      model: activeModel,
      availableModels,
      result: raw,
      message: `Gemini API verified and operational with model ${activeModel}.`
    };
  } catch (genErr) {
    return {
      success: false,
      verified: false,
      keyConfigured: true,
      maskedKey,
      authVerified: modelsListOk,
      model: activeModel,
      error: genErr.message,
      troubleshooting: modelsListOk
        ? "API key is recognized by Google, but content generation failed. See the error details above."
        : "API key could not be authenticated by Google. Please verify your key."
    };
  }
}

let quickStatusCache = {
  keyConfigured: false,
  authVerified: false,
  generationOk: false,
  error: null,
  testedKey: null,
  testedAt: 0
};

async function getQuickStatus() {
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    return {
      keyConfigured: false,
      authVerified: false,
      generationOk: false,
      error: "GEMINI_API_KEY is not configured in backend/.env."
    };
  }

  const now = Date.now();
  if (quickStatusCache.testedKey === apiKey && (now - quickStatusCache.testedAt < 30000)) {
    return quickStatusCache;
  }

  const testRes = await testConnection();
  quickStatusCache = {
    keyConfigured: true,
    authVerified: !!testRes.authVerified || !!testRes.verified,
    generationOk: !!testRes.verified,
    error: testRes.error || null,
    testedKey: apiKey,
    testedAt: now
  };
  return quickStatusCache;
}

module.exports = {
  generateQuestion,
  evaluateAnswer,
  generateFinalReport,
  testConnection,
  getQuickStatus,
  getActiveModel: () => activeModel
};
