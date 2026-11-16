const express = require("express");
const router = express.Router();
const resumeService = require("../services/resumeService");
const db = require("../db");
const config = require("../config");

/**
 * POST /api/resume/parse
 * Accepts base64 encoded document (PDF, DOCX, TXT) or rawText
 */
router.post("/parse", async (req, res, next) => {
  try {
    const { filename = "resume.pdf", base64Data, rawText } = req.body;

    let analysis = null;

    if (base64Data) {
      // Strip data-URI prefix if present
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      if (buffer.length > config.maxUploadSizeBytes) {
        return res.status(400).json({
          error: "Resume file exceeds maximum allowed size (5MB)."
        });
      }

      analysis = resumeService.parseResumeBuffer(buffer, filename);
    } else if (rawText) {
      analysis = resumeService.structuredAnalyze(rawText, filename);
    } else {
      return res.status(400).json({
        error: "Please provide either base64Data (PDF/DOCX) or rawText to parse."
      });
    }

    // Persist to local database
    const saved = await db.saveResume(analysis);

    res.json({
      success: true,
      resume: saved
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resume/latest
 * Retrieves candidate's most recent parsed resume
 */
router.get("/latest", async (req, res, next) => {
  try {
    const latest = await db.getLatestResume();
    res.json(latest || null);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/resume
 * Privacy control to delete all stored candidate resume data
 */
router.delete("/", async (req, res, next) => {
  try {
    await db.deleteResume();
    res.json({ success: true, message: "Resume data deleted successfully." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
