const express = require("express");
const router = express.Router();
const resumeService = require("../services/resumeService");
const db = require("../db");
const config = require("../config");
const { optionalAuth, requireAuth } = require("../middleware/auth");

/**
 * POST /api/resume/parse
 * Accepts base64 encoded document (PDF, DOCX, TXT) or rawText
 */
router.post("/parse", optionalAuth, async (req, res, next) => {
  try {
    const { fileName, filename, base64Data, rawText, mimeType } = req.body;
    const resolvedName = fileName || filename || "resume.pdf";

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

      analysis = resumeService.parseResumeBuffer(buffer, resolvedName);
      if (mimeType) analysis.mime_type = mimeType;
      analysis.filesize = buffer.length;
    } else if (rawText) {
      analysis = resumeService.structuredAnalyze(rawText, resolvedName);
      analysis.filesize = Buffer.byteLength(rawText, "utf8");
    } else {
      return res.status(400).json({
        error: "Please provide either base64Data (PDF/DOCX) or rawText to parse."
      });
    }

    // If authenticated, persist to relational database under user's ownership
    let saved = null;
    if (req.user) {
      saved = await db.saveResume(req.user.id, analysis);
    } else {
      saved = {
        id: "res_temp_" + Date.now(),
        fileName: resolvedName,
        fileSize: analysis.filesize || 0,
        parsedText: analysis.raw_text,
        technicalSkills: analysis.parsed_skills || [],
        education: analysis.parsed_education || [],
        projects: analysis.parsed_projects || [],
        guest: true
      };
    }

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
router.get("/latest", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const latest = await db.getLatestResume(req.user.id);
      res.json(latest || null);
    } else {
      res.json(null);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/resume
 * Deletes candidate's active resume
 */
router.delete("/", requireAuth, async (req, res, next) => {
  try {
    await db.deleteResume(req.user.id);
    res.json({
      success: true,
      message: "Resume document and parsed skill context deleted successfully."
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
