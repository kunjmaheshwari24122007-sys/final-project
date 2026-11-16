const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const { securityHeaders, sanitizeInputs, errorHandler } = require("./middleware/security");

const interviewRoutes = require("./routes/interviewRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const dataRoutes = require("./routes/dataRoutes");
const aiService = require("./services/aiService");

const app = express();

// Security and CORS
app.use(securityHeaders);
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body parsers with payload size limit
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Sanitize user inputs
app.use(sanitizeInputs);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    hasApiKey: !!config.geminiApiKey,
    database: "connected"
  });
});

// Config Status (Without exposing the actual API key)
app.get("/api/config-status", (req, res) => {
  res.json({
    status: "ok",
    aiConfigured: !!config.geminiApiKey,
    currentModel: aiService.getActiveModel(),
    modelCandidates: config.modelCandidates,
    database: "sqlite"
  });
});

// Mount Routes
app.use("/api/interview", interviewRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api", dataRoutes);

// Serve Frontend Static Files from root directory
const rootDir = path.resolve(__dirname, "..");
if (fs.existsSync(path.join(rootDir, "index.html"))) {
  app.use(express.static(rootDir));
  app.get("*", (req, res, next) => {
    // If request does not start with /api, serve index.html
    if (!req.path.startsWith("/api")) {
      return res.sendFile(path.join(rootDir, "index.html"));
    }
    next();
  });
}

// Error Handling Middleware
app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  InterviewAce AI - Production Full-Stack Server    `);
  console.log(`====================================================`);
  console.log(`  Local URL:        http://localhost:${PORT}`);
  console.log(`  API Health:       http://localhost:${PORT}/api/health`);
  console.log(`  Gemini Key:       ${config.geminiApiKey ? "Configured in .env" : "NOT CONFIGURED"}`);
  console.log(`  Database:         SQLite Storage Active`);
  console.log(`====================================================`);
});

module.exports = app;
