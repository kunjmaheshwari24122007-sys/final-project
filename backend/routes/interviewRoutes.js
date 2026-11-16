const express = require("express");
const router = express.Router();
const aiService = require("../services/aiService");
const { rateLimiter } = require("../middleware/security");
const config = require("../config");

// Rate limit AI requests to prevent quota exhaustion
const aiLimiter = rateLimiter(config.aiRateLimitMax, config.rateLimitWindowMs);

/**
 * POST /api/interview/generate-question
 * Generates the next adaptive question based on role, difficulty, and candidate context
 */
router.post("/generate-question", aiLimiter, async (req, res, next) => {
  try {
    const questionData = await aiService.generateQuestion(req.body);
    res.json(questionData);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/evaluate-answer
 * Strictly evaluates an answer across the 6 criteria with honest scoring
 */
router.post("/evaluate-answer", aiLimiter, async (req, res, next) => {
  try {
    const evaluation = await aiService.evaluateAnswer(req.body);
    res.json(evaluation);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/generate-report
 * Analyzes full transcript to produce diagnostic report & 7-day preparation plan
 */
router.post("/generate-report", aiLimiter, async (req, res, next) => {
  try {
    const report = await aiService.generateFinalReport(req.body);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview
 * Unified endpoint for backwards compatibility
 */
router.post("/", aiLimiter, async (req, res, next) => {
  try {
    const { role = "Web Developer", difficulty = "Entry-level / Junior", messages = [] } = req.body;
    const userAnswers = messages.filter(m => m.role === "user");
    const count = userAnswers.length;

    if (count === 0) {
      const q1 = await aiService.generateQuestion({ role, difficulty, questionNumber: 1 });
      return res.json({
        question: q1.question,
        type: q1.type || "HR",
        tip: q1.tip || "",
        question_number: 1,
        total_questions: 5
      });
    }

    const latestAnswer = userAnswers[userAnswers.length - 1]?.content || "";
    const latestQuestionText = messages.filter(m => m.role === "assistant").pop()?.content || "";

    const evalResult = await aiService.evaluateAnswer({
      role,
      difficulty,
      questionObj: { question: latestQuestionText, type: "Technical" },
      answer: latestAnswer
    });

    if (count >= 5) {
      // Final round
      const formattedQA = [];
      const asstMsgs = messages.filter(m => m.role === "assistant");
      for (let i = 0; i < userAnswers.length; i++) {
        formattedQA.push({
          question: asstMsgs[i]?.content || `Question ${i + 1}`,
          type: "Technical",
          answer: userAnswers[i]?.content || "",
          score: i === userAnswers.length - 1 ? evalResult.score : 7
        });
      }

      const report = await aiService.generateFinalReport({
        role,
        difficulty,
        questionsAndAnswers: formattedQA
      });

      return res.json({
        ...evalResult,
        ...report
      });
    }

    // Next question
    const nextQNum = count + 1;
    const nextQ = await aiService.generateQuestion({
      role,
      difficulty,
      questionNumber: nextQNum,
      category: nextQNum === 2 ? "Technical" : (nextQNum === 3 ? "Behavioral" : "Situational"),
      previousQuestions: messages.filter(m => m.role === "assistant").map(m => m.content),
      previousAnswers: userAnswers.map(m => m.content)
    });

    return res.json({
      ...evalResult,
      next_question: nextQ.question,
      next_type: nextQ.type || "Technical"
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
