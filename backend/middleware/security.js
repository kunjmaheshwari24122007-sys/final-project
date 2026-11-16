const config = require("../config");

// Simple, robust in-memory rate limiter
const ipRequests = new Map();

function rateLimiter(maxRequests, windowMs = config.rateLimitWindowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || "127.0.0.1";
    const now = Date.now();

    let clientRecord = ipRequests.get(ip);
    if (!clientRecord || now - clientRecord.windowStart > windowMs) {
      clientRecord = { windowStart: now, count: 1 };
      ipRequests.set(ip, clientRecord);
    } else {
      clientRecord.count++;
    }

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - clientRecord.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil((clientRecord.windowStart + windowMs) / 1000));

    if (clientRecord.count > maxRequests) {
      return res.status(429).json({
        error: "Too many requests. Please wait a moment before trying again."
      });
    }

    next();
  };
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequests.entries()) {
    if (now - record.windowStart > config.rateLimitWindowMs * 2) {
      ipRequests.delete(ip);
    }
  }
}, config.rateLimitWindowMs * 5);

// Security Headers Middleware
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
}

// Input Sanitization helper
function sanitizeString(str) {
  if (typeof str !== "string") return str;
  // Remove null bytes and dangerous script injections while preserving valid symbols
  return str
    .replace(/\0/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function sanitizeInputs(req, res, next) {
  function sanitizeObj(obj) {
    if (!obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "string") {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        sanitizeObj(obj[key]);
      }
    }
  }

  if (req.body) sanitizeObj(req.body);
  if (req.query) sanitizeObj(req.query);
  if (req.params) sanitizeObj(req.params);

  next();
}

// Safe error handler that never leaks credentials
function errorHandler(err, req, res, next) {
  console.error("[InterviewAce Backend Error]", err.message || err);
  const status = err.status || 500;
  let clientMessage = err.message || "An unexpected error occurred.";

  // Sanitize internal error messages so API keys are never leaked
  if (clientMessage.includes(config.geminiApiKey) && config.geminiApiKey) {
    clientMessage = clientMessage.replaceAll(config.geminiApiKey, "[REDACTED_API_KEY]");
  }

  res.status(status).json({
    error: clientMessage
  });
}

module.exports = {
  rateLimiter,
  securityHeaders,
  sanitizeInputs,
  errorHandler
};
