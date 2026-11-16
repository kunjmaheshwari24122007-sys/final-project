const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

// --- 1. User Profile Routes ---
router.get("/profile", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const profile = await db.getProfile(req.user.id);
      res.json(profile);
    } else {
      const defaults = await db.getProfile(null);
      res.json(defaults);
    }
  } catch (err) {
    next(err);
  }
});

router.post("/profile", requireAuth, async (req, res, next) => {
  try {
    const updated = await db.saveProfile(req.user.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const updated = await db.saveProfile(req.user.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// --- 2. Session History Routes ---
router.get("/history", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const sessions = await db.getInterviewSessions(req.user.id);
      res.json(sessions);
    } else {
      res.json([]);
    }
  } catch (err) {
    next(err);
  }
});

router.get("/history/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await db.getInterviewSessionById(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Interview session not found or access denied." });
    }
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.post("/history", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const saved = await db.saveInterviewSession(req.user.id, req.body);
      res.json(saved);
    } else {
      res.json({ id: req.body.id || "sess_" + Date.now(), guest: true, savedLocally: true });
    }
  } catch (err) {
    next(err);
  }
});

router.delete("/history/:id", requireAuth, async (req, res, next) => {
  try {
    await db.deleteInterviewSession(req.user.id, req.params.id);
    res.json({ success: true, message: "Interview session deleted successfully." });
  } catch (err) {
    next(err);
  }
});

router.delete("/history", requireAuth, async (req, res, next) => {
  try {
    await db.clearAllInterviewSessions(req.user.id);
    res.json({ success: true, message: "All interview sessions cleared." });
  } catch (err) {
    next(err);
  }
});

// --- 3. Personal Dashboard Metrics ---
router.get("/dashboard", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const metrics = await db.getDashboardMetrics(req.user.id);
      const sessions = await db.getInterviewSessions(req.user.id);

      let improvement = null;
      if (sessions.length >= 2) {
        improvement = (sessions[0].finalScore || 0) - (sessions[sessions.length - 1].finalScore || 0);
      }

      const validCats = Object.entries(metrics.categoryBreakdown || {})
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1]);

      const strongestCategory = validCats.length > 0 ? { category: validCats[0][0], avgScore: validCats[0][1] } : null;
      const weakestCategory = validCats.length > 0 ? { category: validCats[validCats.length - 1][0], avgScore: validCats[validCats.length - 1][1] } : null;

      res.json({
        authenticated: true,
        user: req.user,
        totalSessions: metrics.totalInterviews,
        avgScore: metrics.averageScore,
        bestScore: metrics.bestScore,
        improvement,
        strongestCategory,
        weakestCategory,
        categoryBreakdown: metrics.categoryBreakdown,
        strengths: metrics.strengths,
        weaknesses: metrics.weaknesses,
        savedQuestionsCount: metrics.savedQuestionsCount,
        planProgressPercent: metrics.planProgressPercent,
        sessions
      });
    } else {
      res.json({
        authenticated: false,
        totalSessions: 0,
        avgScore: null,
        bestScore: null,
        improvement: null,
        strongestCategory: null,
        weakestCategory: null,
        sessions: []
      });
    }
  } catch (err) {
    next(err);
  }
});

// --- 4. Bookmarks Routes ---
router.get("/bookmarks", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const bookmarks = await db.getBookmarks(req.user.id);
      res.json({ success: true, bookmarks });
    } else {
      res.json({ success: true, bookmarks: [] });
    }
  } catch (err) {
    next(err);
  }
});

router.post("/bookmarks", requireAuth, async (req, res, next) => {
  try {
    const { questionId, note } = req.body;
    if (!questionId) {
      return res.status(400).json({ error: "questionId is required" });
    }
    const bookmarks = await db.addBookmark(req.user.id, questionId, note);
    res.json({ success: true, bookmarks });
  } catch (err) {
    next(err);
  }
});

router.delete("/bookmarks/:id", requireAuth, async (req, res, next) => {
  try {
    const bookmarks = await db.removeBookmark(req.user.id, req.params.id);
    res.json({ success: true, bookmarks });
  } catch (err) {
    next(err);
  }
});

// --- 5. 7-Day Plan Routes ---
router.get("/plan", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const plan = await db.getPrepPlan(req.user.id);
      res.json({ success: true, plan });
    } else {
      res.json({ success: true, plan: { planItems: [], completedDays: [] } });
    }
  } catch (err) {
    next(err);
  }
});

router.post("/plan", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const saved = await db.savePrepPlan(req.user.id, req.body);
      res.json({ success: true, plan: saved });
    } else {
      res.json({ success: true, guest: true });
    }
  } catch (err) {
    next(err);
  }
});

router.put("/plan", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const saved = await db.savePrepPlan(req.user.id, req.body);
      res.json({ success: true, plan: saved });
    } else {
      res.json({ success: true, guest: true });
    }
  } catch (err) {
    next(err);
  }
});

router.delete("/plan", requireAuth, async (req, res, next) => {
  try {
    await db.resetPrepPlan(req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- 6. Privacy & Data Export ---
router.get("/data/export", requireAuth, async (req, res, next) => {
  try {
    const exportData = await db.exportUserData(req.user.id);
    res.setHeader("Content-Disposition", `attachment; filename=interviewace_backup_${new Date().toISOString().split("T")[0]}.json`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    next(err);
  }
});

router.delete("/data/reset", requireAuth, async (req, res, next) => {
  try {
    await db.clearAllInterviewSessions(req.user.id);
    await db.resetPrepPlan(req.user.id);
    await db.deleteResume(req.user.id);
    res.json({ success: true, message: "All interview sessions, plans, and resumes wiped clean." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
