const express = require("express");
const { z } = require("zod");
const router = express.Router();
const db = require("../db");
const config = require("../config");
const {
  hashPassword,
  comparePassword,
  generateSessionToken,
  hashToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  optionalAuth
} = require("../middleware/auth");

// Zod Validation Schemas - Accepts ANY valid worldwide email (Gmail, Yahoo, Outlook, custom domains, etc.)
const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long").max(60, "Name cannot exceed 60 characters"),
  email: z.string().trim().email("Please provide a valid email address (e.g., name@gmail.com)").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters long").max(100, "Password too long"),
  branch: z.string().optional().default(""),
  year: z.string().optional().default("1st Year")
});

const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required")
});

/**
 * POST /api/auth/register
 * Creates a new user account with secure password hashing
 */
router.post("/register", async (req, res, next) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map(e => e.message).join(". ");
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const { name, email, password, branch, year } = parseResult.data;

    // Duplicate email check
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "An account with this email address already exists. Please log in instead.",
        code: "EMAIL_ALREADY_EXISTS"
      });
    }

    // Password hashing with bcrypt
    const passwordHash = await hashPassword(password);
    const newUser = await db.createUser(name, email, passwordHash, branch, year);

    // Create session
    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.sessionDurationMs).toISOString();
    const userAgent = req.headers["user-agent"] || "";
    const ipAddress = req.ip || req.connection?.remoteAddress || "";

    await db.createSession(newUser.id, tokenHash, expiresAt, userAgent, ipAddress);
    setSessionCookie(res, rawToken, expiresAt);

    res.status(201).json({
      success: true,
      token: rawToken,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        branch: newUser.branch,
        year: newUser.year
      },
      message: "Account created successfully! Welcome to InterviewAce."
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Verifies password and issues HTTP-only session cookie
 */
router.post("/login", async (req, res, next) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map(e => e.message).join(". ");
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const { email, password } = parseResult.data;

    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password. Please check your credentials.",
        code: "INVALID_CREDENTIALS"
      });
    }

    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password. Please check your credentials.",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Issue session token
    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.sessionDurationMs).toISOString();
    const userAgent = req.headers["user-agent"] || "";
    const ipAddress = req.ip || req.connection?.remoteAddress || "";

    await db.createSession(user.id, tokenHash, expiresAt, userAgent, ipAddress);
    setSessionCookie(res, rawToken, expiresAt);

    res.json({
      success: true,
      token: rawToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      message: "Welcome back, " + user.name + "!"
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Destroys session token and clears cookie
 */
router.post("/logout", optionalAuth, async (req, res, next) => {
  try {
    if (req.sessionToken) {
      const tokenHash = hashToken(req.sessionToken);
      await db.deleteSessionByTokenHash(tokenHash);
    }
    clearSessionCookie(res);
    res.json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user or null
 */
router.get("/me", optionalAuth, async (req, res) => {
  if (req.user) {
    res.json({
      authenticated: true,
      user: req.user
    });
  } else {
    res.json({
      authenticated: false,
      user: null
    });
  }
});

/**
 * DELETE /api/auth/account
 * Deletes user account and cascades all associated data
 */
router.delete("/account", requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Password confirmation is required to delete your account." });
    }

    const user = await db.getUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Incorrect password. Account deletion cancelled." });
    }

    await db.deleteAccount(req.user.id);
    clearSessionCookie(res);

    res.json({
      success: true,
      message: "Your account and all associated interview sessions, resumes, and progress records have been permanently deleted."
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
