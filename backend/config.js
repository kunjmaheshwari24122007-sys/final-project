const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Load .env from backend directory first, then root directory if present
const backendEnvPath = path.join(__dirname, ".env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}
const rootEnvPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  defaultModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  modelCandidates: [
    process.env.GEMINI_MODEL || "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3-flash-preview"
  ].filter((v, i, a) => a.indexOf(v) === i),
  sessionCookieName: "interviewace_session",
  sessionSecret: process.env.SESSION_SECRET || "interviewace_fallback_secret_key_2026",
  sessionDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  corsOrigins: process.env.CORS_ORIGIN || "*",
  rateLimitWindowMs: 60 * 1000,
  rateLimitMax: 100,
  aiRateLimitMax: 30,
  maxUploadSizeBytes: 5 * 1024 * 1024, // 5MB
  dbPath: path.join(__dirname, "data", "interviewace.db"),
  jsonBackupPath: path.join(__dirname, "data", "database.json")
};

module.exports = config;
