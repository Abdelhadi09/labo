const rateLimit = require('express-rate-limit');

// ─── Reusable factory ────────────────────────────────────────────────────────
const make = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // Return RateLimit-* headers
    legacyHeaders: false,
    message: { error: message },
    // Key by IP; if you're behind a trusted reverse proxy (Azure, Nginx, etc.)
    // set `app.set('trust proxy', 1)` in server.js so the real IP is used.
    keyGenerator: (req) => req.ip,
  });

// ─── Auth routes ─────────────────────────────────────────────────────────────
// Tight limit: 10 attempts per 15 minutes per IP.
// Covers brute-force on /login and prevents /client/session spam.
const authLimiter = make(
  15 * 60 * 1000,   // 15 min window
  100,
  'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
);

// ─── OCR / file upload ───────────────────────────────────────────────────────
// Tesseract is CPU-heavy. Allow 10 uploads per 10 minutes per IP.
const uploadLimiter = make(
  10 * 60 * 1000,   // 10 min window
  10,
  'Trop de soumissions. Réessayez dans 10 minutes.'
);

// ─── General API ─────────────────────────────────────────────────────────────
// Broad safety net for all other API calls.
const generalLimiter = make(
  60 * 1000,        // 1 min window
  120,
  'Trop de requêtes. Réessayez dans une minute.'
);

module.exports = { authLimiter, uploadLimiter, generalLimiter };