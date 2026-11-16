const express = require("express");
const router = express.Router();
const db = require("../db");

// --- Profile Routes ---
router.get("/profile", async (req, res, next) => {
  try {
    const profile = await db.getProfile();
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.post("/profile", async (req, res, next) => {
  try {
    const updated = await db.saveProfile(req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.put("/profile", async (req, res, next) => {
  try {
    const updated = await db.saveProfile(req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// --- Session History Routes ---
router.get("/history", async (req, res, next) => {
  try {
    const sessions = await db.getSessions();
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.post("/history", async (req, res, next) => {
  try {
    const saved = await db.saveSession(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

router.delete("/history/:id", async (req, res, next) => {
  try {
    await db.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/history", async (req, res, next) => {
  try {
    await db.clearSessions();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- Bookmarks Routes ---
router.get("/bookmarks", async (req, res, next) => {
  try {
    const bookmarks = await db.getBookmarks();
    res.json(bookmarks);
  } catch (err) {
    next(err);
  }
});

router.post("/bookmarks", async (req, res, next) => {
  try {
    const saved = await db.addBookmark(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

router.delete("/bookmarks/:id", async (req, res, next) => {
  try {
    await db.removeBookmark(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- 7-Day Plan Routes ---
router.get("/plan", async (req, res, next) => {
  try {
    const plan = await db.getPlan();
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

router.post("/plan", async (req, res, next) => {
  try {
    const saved = await db.savePlan(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

router.put("/plan", async (req, res, next) => {
  try {
    const saved = await db.savePlan(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

router.delete("/plan", async (req, res, next) => {
  try {
    await db.resetPlan();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- Privacy Controls: Export & Reset ---
router.get("/data/export", async (req, res, next) => {
  try {
    const exportData = await db.exportAll();
    res.setHeader("Content-Disposition", `attachment; filename=interviewace_backup_${new Date().toISOString().split("T")[0]}.json`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    next(err);
  }
});

router.delete("/data/reset", async (req, res, next) => {
  try {
    await db.resetAll();
    res.json({ success: true, message: "All user data wiped clean successfully." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
