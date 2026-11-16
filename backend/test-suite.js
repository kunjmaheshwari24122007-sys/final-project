const db = require("./db");
const { hashPassword, comparePassword, generateSessionToken, hashToken } = require("./middleware/auth");
const aiService = require("./services/aiService");
const resumeService = require("./services/resumeService");

async function runTests() {
  console.log("=================================================");
  console.log("   InterviewAce AI - Comprehensive Test Suite    ");
  console.log("=================================================");
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Password Hashing & Comparison Test
    console.log("\n[Test Suite 1: Authentication & Password Security]");
    const plainPass = "FreshGraduate2026!";
    const hash = await hashPassword(plainPass);
    assert(hash !== plainPass, "Password is encrypted (never stored as plain text)");
    assert(hash.startsWith("$2"), "Password hash uses valid bcrypt format");
    assert(await comparePassword(plainPass, hash), "Correct password validates successfully");
    assert(!(await comparePassword("WrongPassword123", hash)), "Incorrect password fails validation");

    // 2. User Creation & Duplicate Email Prevention
    console.log("\n[Test Suite 2: User Registration & Duplicate Email Guard]");
    const testEmail1 = `fresh_test_${Date.now()}@college.edu`;
    const user1 = await db.createUser("Rahul Sharma", testEmail1, hash);
    assert(user1 && user1.id && user1.email === testEmail1, "User 1 registered with unique ID");

    let duplicateThrew = false;
    try {
      await db.createUser("Duplicate User", testEmail1, hash);
    } catch (e) {
      duplicateThrew = true;
    }
    assert(duplicateThrew, "Duplicate email registration rejected by database constraint");

    // 3. Session Token & Expiration Management
    console.log("\n[Test Suite 3: Server-side Session Management]");
    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    await db.createSession(user1.id, tokenHash, expiresAt, "NodeTestRunner", "127.0.0.1");

    const sessionLookup = await db.getSessionByTokenHash(tokenHash);
    assert(sessionLookup && sessionLookup.user_id === user1.id, "Session token hash validates and resolves to correct user");
    assert(sessionLookup.email === testEmail1, "Session joins user table accurately");

    // 4. Data Isolation Between Multiple Accounts
    console.log("\n[Test Suite 4: Multi-Tenant Data Isolation]");
    const testEmail2 = `priya_test_${Date.now()}@college.edu`;
    const user2 = await db.createUser("Priya Patel", testEmail2, hash);

    // Save session for User 1
    const sess1 = await db.saveInterviewSession(user1.id, {
      id: "sess_u1_" + Date.now(),
      role: "Web Developer",
      difficulty: "Entry-level / Junior",
      totalQuestions: 1,
      finalScore: 85,
      verdict: "Ready",
      mode: "AI",
      questions: [{
        number: 1,
        type: "HR",
        question: "Tell me about yourself",
        answer: "I am a first-year student proficient in HTML, CSS, and basic JavaScript.",
        score: 8
      }]
    });

    // Save session for User 2
    const sess2 = await db.saveInterviewSession(user2.id, {
      id: "sess_u2_" + Date.now(),
      role: "Data Analyst",
      difficulty: "Entry-level / Junior",
      totalQuestions: 1,
      finalScore: 60,
      verdict: "Almost ready",
      mode: "Demo",
      questions: [{
        number: 1,
        type: "Technical",
        question: "What is SQL?",
        answer: "SQL is structured query language for relational databases.",
        score: 6
      }]
    });

    // Verify User 1 cannot see User 2's sessions
    const user1Sessions = await db.getInterviewSessions(user1.id);
    const user2Sessions = await db.getInterviewSessions(user2.id);

    assert(user1Sessions.some(s => s.id === sess1.id), "User 1 sees their own session");
    assert(!user1Sessions.some(s => s.id === sess2.id), "User 1 CANNOT see User 2's session (Strict Isolation)");
    assert(user2Sessions.some(s => s.id === sess2.id), "User 2 sees their own session");
    assert(!user2Sessions.some(s => s.id === sess1.id), "User 2 CANNOT see User 1's session (Strict Isolation)");

    // 5. Dashboard Metrics Calculation Strictly from DB
    console.log("\n[Test Suite 5: Relational Dashboard Metrics Calculation]");
    const u1Metrics = await db.getDashboardMetrics(user1.id);
    assert(u1Metrics.totalInterviews === user1Sessions.length, "Dashboard total interviews matches exact DB record count");
    assert(u1Metrics.bestScore === 85, "Dashboard highest score is accurately computed from relational sessions");

    // 6. Resume Parsing & Ownership Verification
    console.log("\n[Test Suite 6: Resume Intelligence & Ownership]");
    const sampleResumeText = "John Doe. B.Tech Computer Science student. Skills: JavaScript, React, Python, SQL, Git. Built a student management web application using React and Node.js.";
    const parsedResume = resumeService.structuredAnalyze(sampleResumeText, "test_resume.txt");
    assert(parsedResume.parsed_skills.includes("JavaScript"), "Resume extractor identifies JavaScript skill");
    assert(parsedResume.parsed_skills.includes("Python"), "Resume extractor identifies Python skill");

    const savedResume = await db.saveResume(user1.id, parsedResume);
    const retrievedResume = await db.getLatestResume(user1.id);
    const u2Resume = await db.getLatestResume(user2.id);

    assert(retrievedResume && retrievedResume.technicalSkills.includes("React"), "Saved resume correctly linked to User 1");
    assert(u2Resume === null, "User 2 has no access to User 1's uploaded resume");

    // 7. Cascading Account Deletion
    console.log("\n[Test Suite 7: Cascading Data & Account Deletion]");
    await db.deleteAccount(user2.id);
    const deletedUserCheck = await db.getUserById(user2.id);
    const deletedUserSessions = await db.getInterviewSessions(user2.id);
    assert(deletedUserCheck === null, "User 2 account deleted");
    assert(deletedUserSessions.length === 0, "User 2 interview sessions cascade-deleted on account removal");

    // Cleanup User 1
    await db.deleteAccount(user1.id);

    // 8. Honest Answer Scoring Cap & Empty Answer Handling
    console.log("\n[Test Suite 8: Honest Scoring Calibration & Error Handling]");
    const emptyAnswerEval = await aiService.evaluateAnswer({
      role: "Web Developer",
      difficulty: "Entry-level / Junior",
      question: "Explain the CSS Box Model.",
      candidateAnswer: "",
      isQuickFire: false
    });
    assert(emptyAnswerEval.score === 0, "Empty answer correctly yields score of 0");
    assert(emptyAnswerEval.missing_points.length > 0, "Empty answer provides missing key points");

    // Test Gemini API key failure handling
    let caughtGeminiError = false;
    try {
      await aiService.evaluateAnswer({
        role: "Web Developer",
        difficulty: "Entry-level / Junior",
        question: "Explain the CSS Box Model.",
        candidateAnswer: "It has margin, padding, border, and content.",
        isQuickFire: false
      });
    } catch (e) {
      caughtGeminiError = true;
      assert(e.message.includes("Gemini API Key") || e.message.includes("403"), "Invalid API Key produces clear, actionable error message without exposing secrets");
    }
    assert(caughtGeminiError, "Gemini API error handled cleanly and rethrown to caller (No fake scores)");

  } catch (err) {
    console.error("Test execution threw error:", err);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED  `);
  console.log("=================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
