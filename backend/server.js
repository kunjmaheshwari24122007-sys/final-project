const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const { securityHeaders, sanitizeInputs, errorHandler } = require("./middleware/security");

const authRoutes = require("./routes/authRoutes");
const interviewRoutes = require("./routes/interviewRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const dataRoutes = require("./routes/dataRoutes");
const aiService = require("./services/aiService");

const app = express();

// Security Headers
app.use(securityHeaders);

// CORS with credentials for HTTP-only cookies
const corsConfig = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

// Cookie Parser
app.use(cookieParser());

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
    database: "connected",
    engine: "sqlite-relational"
  });
});

// Config Status with dynamic operational probe (Without exposing credentials)
app.get("/api/config-status", async (req, res) => {
  try {
    const quickStatus = await aiService.getQuickStatus();
    res.json({
      status: "ok",
      aiConfigured: quickStatus.keyConfigured,
      aiOperational: quickStatus.generationOk,
      authVerified: quickStatus.authVerified,
      aiError: quickStatus.error,
      currentModel: aiService.getActiveModel(),
      modelCandidates: config.modelCandidates,
      database: "sqlite",
      authSupported: true
    });
  } catch (err) {
    res.json({
      status: "ok",
      aiConfigured: !!config.geminiApiKey,
      aiOperational: false,
      authVerified: false,
      aiError: err.message,
      currentModel: aiService.getActiveModel(),
      modelCandidates: config.modelCandidates,
      database: "sqlite",
      authSupported: true
    });
  }
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api", dataRoutes);

// Serve Frontend Static Files from root directory with no-cache headers
const rootDir = path.resolve(__dirname, "..");
if (fs.existsSync(path.join(rootDir, "index.html"))) {
  app.use(express.static(rootDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }
  }));
  app.get("*", (req, res, next) => {
    // If request does not start with /api, serve index.html
    if (!req.path.startsWith("/api")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.sendFile(path.join(rootDir, "index.html"));
    }
    next();
  });
}

// Error Handling Middleware
app.use(errorHandler);

const PORT = config.port;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  InterviewAce AI - Production Full-Stack Server    `);
    console.log(`====================================================`);
    console.log(`  Local URL:        http://localhost:${PORT}`);
    console.log(`  API Health:       http://localhost:${PORT}/api/health`);
    console.log(`  Auth Engine:      BCrypt + Secure HTTP-only Cookies`);
    console.log(`  Gemini Key:       ${config.geminiApiKey ? "Configured in .env" : "NOT CONFIGURED"}`);
    console.log(`  Database:         Relational SQLite Active`);
    console.log(`====================================================`);
  });
}

module.exports = app;
