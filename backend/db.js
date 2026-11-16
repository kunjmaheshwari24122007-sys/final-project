const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let DatabaseSync;
try {
  DatabaseSync = require("node:sqlite").DatabaseSync;
} catch (e) {
  console.warn("[Database] node:sqlite not available, falling back to simulated memory SQLite driver");
}

class RelationalDatabase {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    try {
      if (DatabaseSync) {
        this.db = new DatabaseSync(config.dbPath);
        this.db.exec("PRAGMA foreign_keys = ON;");
        this.db.exec("PRAGMA journal_mode = WAL;");
        this.runMigrations();
      } else {
        throw new Error("Native SQLite unavailable");
      }
    } catch (err) {
      console.warn("[Database] Error initializing native SQLite, using persistent fallback:", err.message);
      this.initFallback();
    }
  }

  runMigrations() {
    // 1. Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 2. Auth Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT
      );
    `);

    // 3. User Profiles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        name TEXT,
        college TEXT,
        year TEXT DEFAULT '1st Year',
        branch TEXT DEFAULT 'Engineering',
        target_role TEXT DEFAULT 'Web Developer',
        difficulty TEXT DEFAULT 'Entry-level / Junior',
        goal TEXT DEFAULT 'Placement',
        question_count INTEGER DEFAULT 5,
        voice_mode INTEGER DEFAULT 1,
        quick_fire INTEGER DEFAULT 1,
        company_type TEXT DEFAULT 'Product',
        updated_at TEXT NOT NULL
      );
    `);

    // 4. Interview Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS interview_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        total_questions INTEGER NOT NULL,
        final_score INTEGER NOT NULL,
        verdict TEXT NOT NULL,
        mode TEXT NOT NULL,
        quick_fire_enabled INTEGER DEFAULT 1,
        category_scores_json TEXT,
        strengths_json TEXT,
        weaknesses_json TEXT,
        seven_day_plan_json TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // 5. Session Questions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_questions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_number INTEGER NOT NULL,
        type TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT,
        score INTEGER DEFAULT 0,
        criteria_json TEXT,
        good TEXT,
        improve TEXT,
        missing_points_json TEXT,
        sample_answer TEXT,
        filler_words_json TEXT,
        follow_up_question TEXT,
        score_capped INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // 6. Bookmarks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(user_id, question_id)
      );
    `);

    // 7. Preparation Plans table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prep_plans (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        plan_items_json TEXT,
        completed_days_json TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    // 8. Resumes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resumes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        filesize INTEGER NOT NULL,
        mime_type TEXT,
        parsed_text TEXT,
        skills_json TEXT,
        education_json TEXT,
        projects_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Performance Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_interview_sessions_created_at ON interview_sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_session_questions_session_id ON session_questions(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_questions_user_id ON session_questions(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
      CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
    `);
  }

  // --- USER AUTHENTICATION & MANAGEMENT ---
  async createUser(name, email, passwordHash) {
    const id = "usr_" + crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanEmail = email.toLowerCase().trim();

    const insert = this.db.prepare(`
      INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run(id, name.trim(), cleanEmail, passwordHash, now, now);

    // Create default profile for this user
    const insertProfile = this.db.prepare(`
      INSERT INTO user_profiles (user_id, name, updated_at)
      VALUES (?, ?, ?)
    `);
    insertProfile.run(id, name.trim(), now);

    return { id, name: name.trim(), email: cleanEmail, created_at: now };
  }

  async getUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    const stmt = this.db.prepare(`SELECT * FROM users WHERE email = ?`);
    return stmt.get(cleanEmail) || null;
  }

  async getUserById(id) {
    if (!id) return null;
    const stmt = this.db.prepare(`SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?`);
    return stmt.get(id) || null;
  }

  async deleteUser(id) {
    if (!id) return false;
    const stmt = this.db.prepare(`DELETE FROM users WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // --- SESSIONS ---
  async createSession(userId, tokenHash, expiresAt, userAgent = "", ipAddress = "") {
    const id = "sess_tok_" + crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt, now, userAgent, ipAddress);
    return { id, userId, expiresAt };
  }

  async getSessionByTokenHash(tokenHash) {
    if (!tokenHash) return null;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT s.id AS session_id, s.user_id, s.expires_at, u.name, u.email
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `);
    const session = stmt.get(tokenHash, now);
    return session || null;
  }

  async deleteSessionByTokenHash(tokenHash) {
    if (!tokenHash) return false;
    const stmt = this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`);
    const result = stmt.run(tokenHash);
    return result.changes > 0;
  }

  async deleteExpiredSessions() {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`);
    stmt.run(now);
  }

  async deleteAllUserSessions(userId) {
    const stmt = this.db.prepare(`DELETE FROM sessions WHERE user_id = ?`);
    stmt.run(userId);
  }

  // --- USER PROFILES ---
  async getProfile(userId) {
    const defaults = {
      name: "",
      college: "",
      year: "1st Year",
      branch: "Engineering",
      targetRole: "Web Developer",
      difficulty: "Entry-level / Junior",
      goal: "Placement",
      defaults: {
        role: "Web Developer",
        difficulty: "Entry-level / Junior",
        questionCount: 5,
        voiceMode: true,
        quickFire: true,
        companyType: "Product"
      }
    };

    if (!userId) return defaults;

    const stmt = this.db.prepare(`
      SELECT p.*, u.email, u.name AS account_name
      FROM user_profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
    `);
    const row = stmt.get(userId);
    if (!row) return defaults;

    return {
      name: row.name || row.account_name || "",
      email: row.email || "",
      college: row.college || "",
      year: row.year || "1st Year",
      branch: row.branch || "Engineering",
      targetRole: row.target_role || "Web Developer",
      difficulty: row.difficulty || "Entry-level / Junior",
      goal: row.goal || "Placement",
      defaults: {
        role: row.target_role || "Web Developer",
        difficulty: row.difficulty || "Entry-level / Junior",
        questionCount: row.question_count || 5,
        voiceMode: Boolean(row.voice_mode),
        quickFire: Boolean(row.quick_fire),
        companyType: row.company_type || "Product"
      },
      updatedAt: row.updated_at
    };
  }

  async saveProfile(userId, profile) {
    const now = new Date().toISOString();
    const def = profile.defaults || {};

    const stmt = this.db.prepare(`
      INSERT INTO user_profiles (
        user_id, name, college, year, branch, target_role, difficulty, goal,
        question_count, voice_mode, quick_fire, company_type, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        name = excluded.name,
        college = excluded.college,
        year = excluded.year,
        branch = excluded.branch,
        target_role = excluded.target_role,
        difficulty = excluded.difficulty,
        goal = excluded.goal,
        question_count = excluded.question_count,
        voice_mode = excluded.voice_mode,
        quick_fire = excluded.quick_fire,
        company_type = excluded.company_type,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      userId,
      profile.name || "",
      profile.college || "",
      profile.year || "1st Year",
      profile.branch || "Engineering",
      profile.targetRole || def.role || "Web Developer",
      profile.difficulty || def.difficulty || "Entry-level / Junior",
      profile.goal || "Placement",
      def.questionCount || 5,
      def.voiceMode === false ? 0 : 1,
      def.quickFire === false ? 0 : 1,
      def.companyType || "Product",
      now
    );

    return this.getProfile(userId);
  }

  // --- INTERVIEW SESSIONS & QUESTIONS ---
  async saveInterviewSession(userId, data) {
    const sessionId = data.id || "sess_" + Date.now();
    const now = data.date || new Date().toISOString();

    const stmtSession = this.db.prepare(`
      INSERT OR REPLACE INTO interview_sessions (
        id, user_id, role, difficulty, total_questions, final_score,
        verdict, mode, quick_fire_enabled, category_scores_json,
        strengths_json, weaknesses_json, seven_day_plan_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmtSession.run(
      sessionId,
      userId,
      data.role || "Web Developer",
      data.difficulty || "Entry-level / Junior",
      data.totalQuestions || (data.questions ? data.questions.length : 5),
      typeof data.finalScore === "number" ? data.finalScore : 0,
      data.verdict || "Needs practice",
      data.mode || "AI",
      data.quickFireEnabled === false ? 0 : 1,
      JSON.stringify(data.categoryScores || {}),
      JSON.stringify(data.strengths || []),
      JSON.stringify(data.weaknesses || []),
      JSON.stringify(data.seven_day_plan || []),
      now
    );

    // Save questions
    if (Array.isArray(data.questions)) {
      const deleteOld = this.db.prepare(`DELETE FROM session_questions WHERE session_id = ? AND user_id = ?`);
      deleteOld.run(sessionId, userId);

      const stmtQ = this.db.prepare(`
        INSERT INTO session_questions (
          id, session_id, user_id, question_number, type, question, answer, score,
          criteria_json, good, improve, missing_points_json, sample_answer,
          filler_words_json, follow_up_question, score_capped, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      data.questions.forEach((q, idx) => {
        const qId = `${sessionId}_q${idx + 1}`;
        stmtQ.run(
          qId,
          sessionId,
          userId,
          q.number || idx + 1,
          q.type || "Technical",
          q.question || "",
          q.answer || "",
          typeof q.score === "number" ? q.score : 0,
          JSON.stringify(q.criteria || {}),
          q.good || "",
          q.improve || "",
          JSON.stringify(q.missing_points || []),
          q.sample_answer || "",
          JSON.stringify(q.filler_words || []),
          q.follow_up_question || "",
          q.scoreCapped ? 1 : 0,
          now
        );
      });
    }

    return this.getInterviewSessionById(userId, sessionId);
  }

  async getInterviewSessions(userId) {
    if (!userId) return [];
    const stmt = this.db.prepare(`
      SELECT * FROM interview_sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `);
    const rows = stmt.all(userId);

    const stmtQuestions = this.db.prepare(`
      SELECT * FROM session_questions
      WHERE session_id = ? AND user_id = ?
      ORDER BY question_number ASC
    `);

    return rows.map(r => {
      const qRows = stmtQuestions.all(r.id, userId);
      return {
        id: r.id,
        date: r.created_at,
        role: r.role,
        difficulty: r.difficulty,
        totalQuestions: r.total_questions,
        finalScore: r.final_score,
        verdict: r.verdict,
        mode: r.mode,
        quickFireEnabled: Boolean(r.quick_fire_enabled),
        categoryScores: JSON.parse(r.category_scores_json || "{}"),
        strengths: JSON.parse(r.strengths_json || "[]"),
        weaknesses: JSON.parse(r.weaknesses_json || "[]"),
        seven_day_plan: JSON.parse(r.seven_day_plan_json || "[]"),
        questions: qRows.map(q => ({
          number: q.question_number,
          type: q.type,
          question: q.question,
          answer: q.answer,
          score: q.score,
          criteria: JSON.parse(q.criteria_json || "{}"),
          good: q.good,
          improve: q.improve,
          missing_points: JSON.parse(q.missing_points_json || "[]"),
          sample_answer: q.sample_answer,
          filler_words: JSON.parse(q.filler_words_json || "[]"),
          follow_up_question: q.follow_up_question,
          scoreCapped: Boolean(q.score_capped)
        }))
      };
    });
  }

  async getInterviewSessionById(userId, sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM interview_sessions
      WHERE id = ? AND user_id = ?
    `);
    const r = stmt.get(sessionId, userId);
    if (!r) return null;

    const stmtQ = this.db.prepare(`
      SELECT * FROM session_questions
      WHERE session_id = ? AND user_id = ?
      ORDER BY question_number ASC
    `);
    const qRows = stmtQ.all(sessionId, userId);

    return {
      id: r.id,
      date: r.created_at,
      role: r.role,
      difficulty: r.difficulty,
      totalQuestions: r.total_questions,
      finalScore: r.final_score,
      verdict: r.verdict,
      mode: r.mode,
      quickFireEnabled: Boolean(r.quick_fire_enabled),
      categoryScores: JSON.parse(r.category_scores_json || "{}"),
      strengths: JSON.parse(r.strengths_json || "[]"),
      weaknesses: JSON.parse(r.weaknesses_json || "[]"),
      seven_day_plan: JSON.parse(r.seven_day_plan_json || "[]"),
      questions: qRows.map(q => ({
        number: q.question_number,
        type: q.type,
        question: q.question,
        answer: q.answer,
        score: q.score,
        criteria: JSON.parse(q.criteria_json || "{}"),
        good: q.good,
        improve: q.improve,
        missing_points: JSON.parse(q.missing_points_json || "[]"),
        sample_answer: q.sample_answer,
        filler_words: JSON.parse(q.filler_words_json || "[]"),
        follow_up_question: q.follow_up_question,
        scoreCapped: Boolean(q.score_capped)
      }))
    };
  }

  async deleteInterviewSession(userId, sessionId) {
    const stmt = this.db.prepare(`DELETE FROM interview_sessions WHERE id = ? AND user_id = ?`);
    const result = stmt.run(sessionId, userId);
    return result.changes > 0;
  }

  async clearAllInterviewSessions(userId) {
    const stmt = this.db.prepare(`DELETE FROM interview_sessions WHERE user_id = ?`);
    stmt.run(userId);
    return true;
  }

  // --- BOOKMARKS ---
  async getBookmarks(userId) {
    if (!userId) return [];
    const stmt = this.db.prepare(`SELECT question_id, note, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC`);
    const rows = stmt.all(userId);
    return rows.map(r => r.question_id);
  }

  async addBookmark(userId, questionId, note = "") {
    const id = "bm_" + crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO bookmarks (id, user_id, question_id, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, questionId, note || "", now);
    return this.getBookmarks(userId);
  }

  async removeBookmark(userId, questionId) {
    const stmt = this.db.prepare(`DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?`);
    stmt.run(userId, questionId);
    return this.getBookmarks(userId);
  }

  // --- PREPARATION PLANS ---
  async getPrepPlan(userId) {
    if (!userId) return { planItems: [], completedDays: [] };
    const stmt = this.db.prepare(`SELECT * FROM prep_plans WHERE user_id = ?`);
    const row = stmt.get(userId);
    if (!row) return { planItems: [], completedDays: [] };
    return {
      planItems: JSON.parse(row.plan_items_json || "[]"),
      completedDays: JSON.parse(row.completed_days_json || "[]"),
      updatedAt: row.updated_at
    };
  }

  async savePrepPlan(userId, plan) {
    const now = new Date().toISOString();
    const items = plan.planItems || plan.seven_day_plan || [];
    const completed = plan.completedDays || [];

    const stmt = this.db.prepare(`
      INSERT INTO prep_plans (user_id, plan_items_json, completed_days_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        plan_items_json = CASE WHEN excluded.plan_items_json != '[]' THEN excluded.plan_items_json ELSE prep_plans.plan_items_json END,
        completed_days_json = excluded.completed_days_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(userId, JSON.stringify(items), JSON.stringify(completed), now);
    return this.getPrepPlan(userId);
  }

  async resetPrepPlan(userId) {
    const stmt = this.db.prepare(`DELETE FROM prep_plans WHERE user_id = ?`);
    stmt.run(userId);
    return { planItems: [], completedDays: [] };
  }

  // --- RESUMES ---
  async saveResume(userId, data) {
    const id = "res_" + crypto.randomUUID();
    const now = new Date().toISOString();

    // Enforce 1 active resume per user by replacing previous
    const deleteOld = this.db.prepare(`DELETE FROM resumes WHERE user_id = ?`);
    deleteOld.run(userId);

    const stmt = this.db.prepare(`
      INSERT INTO resumes (
        id, user_id, filename, filesize, mime_type, parsed_text,
        skills_json, education_json, projects_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      data.filename || "resume.pdf",
      data.filesize || 0,
      data.mime_type || "application/pdf",
      data.parsed_text || data.raw_text || "",
      JSON.stringify(data.parsed_skills || []),
      JSON.stringify(data.parsed_education || []),
      JSON.stringify(data.parsed_projects || []),
      now,
      now
    );

    return this.getLatestResume(userId);
  }

  async getLatestResume(userId) {
    if (!userId) return null;
    const stmt = this.db.prepare(`SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`);
    const row = stmt.get(userId);
    if (!row) return null;

    return {
      id: row.id,
      fileName: row.filename,
      fileSize: row.filesize,
      mimeType: row.mime_type,
      parsedText: row.parsed_text,
      technicalSkills: JSON.parse(row.skills_json || "[]"),
      education: JSON.parse(row.education_json || "[]"),
      projects: JSON.parse(row.projects_json || "[]"),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async deleteResume(userId) {
    const stmt = this.db.prepare(`DELETE FROM resumes WHERE user_id = ?`);
    stmt.run(userId);
    return true;
  }

  // --- REAL DASHBOARD METRICS CALCULATION ---
  async getDashboardMetrics(userId) {
    if (!userId) {
      return {
        totalInterviews: 0,
        averageScore: 0,
        bestScore: 0,
        recentScores: [],
        categoryBreakdown: { HR: 0, Technical: 0, Behavioral: 0, Situational: 0, "Resume-based": 0 },
        strengths: [],
        weaknesses: [],
        savedQuestionsCount: 0,
        planProgressPercent: 0
      };
    }

    const sessions = await this.getInterviewSessions(userId);
    const bookmarks = await this.getBookmarks(userId);
    const plan = await this.getPrepPlan(userId);

    if (sessions.length === 0) {
      return {
        totalInterviews: 0,
        averageScore: 0,
        bestScore: 0,
        recentScores: [],
        categoryBreakdown: { HR: 0, Technical: 0, Behavioral: 0, Situational: 0, "Resume-based": 0 },
        strengths: ["Complete your first mock interview to diagnose key strengths."],
        weaknesses: ["Take a practice session to uncover targeted areas for growth."],
        savedQuestionsCount: bookmarks.length,
        planProgressPercent: 0
      };
    }

    const scores = sessions.map(s => s.finalScore || 0);
    const totalInterviews = sessions.length;
    const bestScore = Math.max(...scores);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / totalInterviews);

    // Compute category breakdown from question scores
    const categoryTotals = {};
    const categoryCounts = {};

    sessions.forEach(s => {
      if (s.questions) {
        s.questions.forEach(q => {
          let cat = q.type || "Technical";
          if (cat === "Resume" || cat === "Resume-based") cat = "Resume-based";
          if (cat === "QuickFire" || cat === "Quick-fire") cat = "Technical";

          categoryTotals[cat] = (categoryTotals[cat] || 0) + (q.score || 0);
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
      }
    });

    const categoryBreakdown = {};
    ["HR", "Technical", "Behavioral", "Situational", "Resume-based"].forEach(cat => {
      const count = categoryCounts[cat] || 0;
      categoryBreakdown[cat] = count > 0 ? Math.round((categoryTotals[cat] / count) * 10) : 0;
    });

    // Aggregate strengths & weaknesses from sessions
    const strengthsSet = new Set();
    const weaknessesSet = new Set();
    sessions.slice(0, 5).forEach(s => {
      (s.strengths || []).forEach(st => strengthsSet.add(st));
      (s.weaknesses || []).forEach(w => weaknessesSet.add(w));
    });

    const completedPlanCount = (plan.completedDays || []).length;
    const planTotal = (plan.planItems || []).length || 7;
    const planProgressPercent = Math.min(100, Math.round((completedPlanCount / planTotal) * 100));

    return {
      totalInterviews,
      averageScore,
      bestScore,
      recentScores: sessions.slice(0, 10).map(s => ({ date: s.date, score: s.finalScore, role: s.role })),
      categoryBreakdown,
      strengths: Array.from(strengthsSet).slice(0, 4),
      weaknesses: Array.from(weaknessesSet).slice(0, 4),
      savedQuestionsCount: bookmarks.length,
      planProgressPercent
    };
  }

  // --- DATA EXPORT & ACCOUNT WIPEOUT ---
  async exportUserData(userId) {
    const user = await this.getUserById(userId);
    const profile = await this.getProfile(userId);
    const sessions = await this.getInterviewSessions(userId);
    const bookmarks = await this.getBookmarks(userId);
    const plan = await this.getPrepPlan(userId);
    const resume = await this.getLatestResume(userId);

    return {
      exportedAt: new Date().toISOString(),
      version: "3.0.0",
      user,
      profile,
      sessions,
      bookmarks,
      plan,
      resume
    };
  }

  async deleteAccount(userId) {
    return this.deleteUser(userId);
  }
}

const db = new RelationalDatabase();
module.exports = db;
