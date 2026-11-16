const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../db");
const config = require("../config");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 12);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function setSessionCookie(res, token, expiresAt) {
  const isProd = config.nodeEnv === "production";
  res.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    expires: new Date(expiresAt),
    path: "/"
  });
}

function clearSessionCookie(res) {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    path: "/"
  });
}

function extractTokenFromRequest(req) {
  // 1. Check cookies
  if (req.cookies && req.cookies[config.sessionCookieName]) {
    return req.cookies[config.sessionCookieName];
  }

  // 2. Check Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Strict Authentication Middleware
 * Enforces verified session and attaches req.user
 */
async function requireAuth(req, res, next) {
  try {
    const rawToken = extractTokenFromRequest(req);
    if (!rawToken) {
      return res.status(401).json({
        error: "Authentication required. Please log in to access this feature.",
        code: "UNAUTHORIZED"
      });
    }

    const tokenHash = hashToken(rawToken);
    const session = await db.getSessionByTokenHash(tokenHash);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({
        error: "Your session has expired or is invalid. Please log in again.",
        code: "SESSION_EXPIRED"
      });
    }

    // Attach verified user identity from server session (never trust client user IDs)
    req.user = {
      id: session.user_id,
      name: session.name,
      email: session.email
    };
    req.sessionToken = rawToken;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional Authentication Middleware
 * Attaches req.user if a valid session exists, but permits guests
 */
async function optionalAuth(req, res, next) {
  try {
    const rawToken = extractTokenFromRequest(req);
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const session = await db.getSessionByTokenHash(tokenHash);
      if (session) {
        req.user = {
          id: session.user_id,
          name: session.name,
          email: session.email
        };
        req.sessionToken = rawToken;
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  } catch (_) {
    req.user = null;
    next();
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  generateSessionToken,
  hashToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  optionalAuth
};
