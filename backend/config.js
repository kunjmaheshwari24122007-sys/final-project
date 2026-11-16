const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  modelCandidates: [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3-flash-preview"
  ],
  defaultModel: "gemini-2.5-flash",
  corsOrigins: process.env.CORS_ORIGIN || "*",
  rateLimitWindowMs: 60 * 1000,
  rateLimitMax: 60,
  aiRateLimitMax: 25,
  maxUploadSizeBytes: 5 * 1024 * 1024, // 5MB
  dbPath: path.join(__dirname, "data", "interviewace.db"),
  jsonBackupPath: path.join(__dirname, "data", "database.json")
};

module.exports = config;
