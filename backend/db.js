const fs = require("fs");
const path = require("path");
const config = require("./config");

// Ensure data directory exists
const dataDir = path.dirname(config.jsonBackupPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * SQLite & Local Storage Engine
 * Clean schema matching SQLite / PostgreSQL tables
 */
class DatabaseManager {
  constructor() {
    this.dbFile = config.jsonBackupPath;
    this.state = {
      profile: {
        name: "",
        college: "",
        year: "1st Year",
        branch: "Engineering",
        targetRole: "Web Developer",
        difficulty: "Entry-level / Junior",
        defaults: {
          questionCount: 5,
          voiceMode: true,
          quickFire: true,
          companyType: "Product"
        },
        updatedAt: new Date().toISOString()
      },
      sessions: [],
      bookmarks: [],
      plan: {},
      resumes: []
    };
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, "utf-8");
        const parsed = JSON.parse(raw);
        this.state = { ...this.state, ...parsed };
      } else {
        this.persist();
      }
    } catch (e) {
      console.warn("[DB] Initialized with empty state due to read error:", e.message);
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.dbFile, JSON.stringify(this.state, null, 2), "utf-8");
    } catch (e) {
      console.error("[DB] Failed to persist data to disk:", e.message);
    }
  }

  // --- Profile Methods ---
  async getProfile() {
    return { ...this.state.profile };
  }

  async saveProfile(profileData) {
    this.state.profile = {
      ...this.state.profile,
      ...profileData,
      updatedAt: new Date().toISOString()
    };
    this.persist();
    return this.getProfile();
  }

  // --- Session Methods ---
  async getSessions() {
    return [...this.state.sessions].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
  }

  async getSession(id) {
    return this.state.sessions.find(s => s.id === id) || null;
  }

  async saveSession(session) {
    const existingIdx = this.state.sessions.findIndex(s => s.id === session.id);
    const record = {
      id: session.id || "session_" + Date.now(),
      created_at: session.created_at || new Date().toISOString(),
      role: session.role || "Web Developer",
      difficulty: session.difficulty || "Entry-level / Junior",
      final_score: typeof session.final_score === "number" ? session.final_score : 0,
      verdict: session.verdict || "Needs practice",
      questions: Array.isArray(session.questions) ? session.questions : [],
      strengths: Array.isArray(session.strengths) ? session.strengths : [],
      weaknesses: Array.isArray(session.weaknesses) ? session.weaknesses : [],
      seven_day_plan: Array.isArray(session.seven_day_plan) ? session.seven_day_plan : [],
      metrics: session.metrics || {}
    };

    if (existingIdx >= 0) {
      this.state.sessions[existingIdx] = record;
    } else {
      this.state.sessions.unshift(record);
    }

    this.persist();
    return record;
  }

  async deleteSession(id) {
    this.state.sessions = this.state.sessions.filter(s => s.id !== id);
    this.persist();
    return { success: true };
  }

  async clearSessions() {
    this.state.sessions = [];
    this.persist();
    return { success: true };
  }

  // --- Bookmarks Methods ---
  async getBookmarks() {
    return [...this.state.bookmarks];
  }

  async addBookmark(bookmark) {
    const exists = this.state.bookmarks.find(b => b.questionId === bookmark.questionId || b.id === bookmark.id);
    if (!exists) {
      const record = {
        id: bookmark.id || "bm_" + Date.now(),
        questionId: bookmark.questionId || bookmark.id,
        category: bookmark.category || "General",
        topic: bookmark.topic || "",
        question: bookmark.question || "",
        tip: bookmark.tip || "",
        sample_answer: bookmark.sample_answer || "",
        bookmarked_at: new Date().toISOString()
      };
      this.state.bookmarks.unshift(record);
      this.persist();
      return record;
    }
    return exists;
  }

  async removeBookmark(questionId) {
    this.state.bookmarks = this.state.bookmarks.filter(b => b.questionId !== questionId && b.id !== questionId);
    this.persist();
    return { success: true };
  }

  // --- 7-Day Plan Progress ---
  async getPlan() {
    return { ...this.state.plan };
  }

  async savePlan(planProgress) {
    this.state.plan = { ...planProgress };
    this.persist();
    return this.getPlan();
  }

  async resetPlan() {
    this.state.plan = {};
    this.persist();
    return { success: true };
  }

  // --- Resume Intelligence Storage ---
  async saveResume(resumeData) {
    const record = {
      id: "resume_" + Date.now(),
      filename: resumeData.filename || "resume.pdf",
      uploaded_at: new Date().toISOString(),
      raw_text: resumeData.raw_text || "",
      parsed_skills: resumeData.parsed_skills || [],
      parsed_projects: resumeData.parsed_projects || [],
      parsed_education: resumeData.parsed_education || []
    };
    this.state.resumes.unshift(record);
    // Keep last 3 resumes
    if (this.state.resumes.length > 3) {
      this.state.resumes = this.state.resumes.slice(0, 3);
    }
    this.persist();
    return record;
  }

  async getLatestResume() {
    return this.state.resumes[0] || null;
  }

  async deleteResume() {
    this.state.resumes = [];
    this.persist();
    return { success: true };
  }

  // --- Full Export & Privacy Wipe ---
  async exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      version: "2.5",
      database: "sqlite-json",
      ...this.state
    };
  }

  async resetAll() {
    this.state = {
      profile: {
        name: "",
        college: "",
        year: "1st Year",
        branch: "Engineering",
        targetRole: "Web Developer",
        difficulty: "Entry-level / Junior",
        defaults: {
          questionCount: 5,
          voiceMode: true,
          quickFire: true,
          companyType: "Product"
        },
        updatedAt: new Date().toISOString()
      },
      sessions: [],
      bookmarks: [],
      plan: {},
      resumes: []
    };
    this.persist();
    return { success: true };
  }
}

const db = new DatabaseManager();
module.exports = db;
