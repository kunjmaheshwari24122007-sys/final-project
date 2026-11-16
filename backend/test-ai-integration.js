/**
 * Verification & Diagnostic Test Suite for InterviewAce Gemini AI Integration
 */
const config = require("./config");
const aiService = require("./services/aiService");

async function runTestSuite() {
  console.log("=================================================");
  console.log("  InterviewAce AI Integration Diagnostic Test    ");
  console.log("=================================================");

  // 1. Verify API Key Loading
  const key = config.geminiApiKey;
  console.log("\n[1] Backend .env Configuration:");
  console.log("  - Key Loaded:", key ? "YES" : "NO");
  console.log("  - Key Length:", key ? key.length : 0);
  console.log("  - Key Format:", key ? (key.slice(0, 7) + "..." + key.slice(-4)) : "N/A");
  console.log("  - Primary Model:", config.defaultModel);
  console.log("  - Candidate Fallbacks:", config.modelCandidates.join(", "));

  // 2. Safe Diagnostic Connection Test
  console.log("\n[2] Diagnostic Connection Test (aiService.testConnection):");
  const connResult = await aiService.testConnection();
  console.log("  - Connection Success:", connResult.success);
  console.log("  - Key Authenticated by Google:", connResult.authVerified ?? connResult.verified);
  console.log("  - Active Model:", connResult.model);
  if (connResult.error) {
    console.log("  - Error Details:", connResult.error);
  }
  if (connResult.troubleshooting) {
    console.log("  - Troubleshooting:", connResult.troubleshooting);
  }

  // 3. Question Generation Test
  console.log("\n[3] Question Generation Test:");
  try {
    const q1 = await aiService.generateQuestion({
      role: "Web Developer",
      difficulty: "Entry-level / Junior",
      questionNumber: 1
    });
    console.log("  - Question 1 (Intro): SUCCESS");
    console.log("    Text:", q1.question);
  } catch (err) {
    console.log("  - Question 1 FAILED:", err.message);
  }

  try {
    const q2 = await aiService.generateQuestion({
      role: "Web Developer",
      difficulty: "Entry-level / Junior",
      questionNumber: 2,
      category: "Technical",
      previousQuestions: ["Tell me about yourself"]
    });
    console.log("  - Question 2 (Gemini API): SUCCESS");
    console.log("    Text:", q2.question);
  } catch (err) {
    console.log("  - Question 2 (Gemini API) FAILED:", err.message);
  }

  // 4. Answer Evaluation Test
  console.log("\n[4] Answer Evaluation Test:");
  try {
    const evalResult = await aiService.evaluateAnswer({
      role: "Web Developer",
      difficulty: "Entry-level / Junior",
      question: "Explain the difference between let, const, and var in JavaScript.",
      category: "Technical",
      candidateAnswer: "let is block scoped and reassignable, const cannot be reassigned, and var is function scoped."
    });
    console.log("  - Answer Evaluation (Gemini API): SUCCESS");
    console.log("    Score:", evalResult.score + "/10");
    console.log("    Good:", evalResult.good);
    console.log("    Improve:", evalResult.improve);
  } catch (err) {
    console.log("  - Answer Evaluation (Gemini API) FAILED:", err.message);
  }

  console.log("\n=================================================");
  console.log("  Diagnostic Test Complete                       ");
  console.log("=================================================");
}

runTestSuite();
