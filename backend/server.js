require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { setupExpressRequestContext, setupExpressErrorHandler } = require('posthog-node');
const posthog = require('./config/posthog');
const { initializeDatabase } = require('./config/database');
const { authLimiter, uploadLimiter, generalLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

// If running behind a reverse proxy (Azure App Service, Nginx, etc.) uncomment
// this so express-rate-limit sees the real client IP instead of the proxy IP:
 app.set('trust proxy', 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// This is a pure JSON API — no HTML, no inline scripts, no iframes — so we can
// apply a strict posture without breaking anything.
app.use(helmet({
  // Content-Security-Policy: lock down to same-origin only.
  // API responses are JSON so there's nothing to load (no scripts, styles,
  // images, frames). This stops a misconfigured response from being rendered
  // as HTML and executing injected content.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],   // block everything by default
      frameAncestors: ["'none'"], // equivalent to X-Frame-Options: DENY
    },
  },

  // HTTP Strict Transport Security: tell browsers to only use HTTPS.
  // 1 year max-age is the recommended value. Remove includeSubDomains if
  // you have non-HTTPS subdomains you don't control.
  hsts: {
    maxAge: 31536000,       // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },

  // X-Content-Type-Options: nosniff — prevents browsers from MIME-sniffing
  // a response away from the declared Content-Type. Stops e.g. a JSON
  // response being treated as HTML/script.
  noSniff: true,

  // X-Frame-Options: DENY — belt-and-suspenders alongside CSP frameAncestors.
  // Protects older browsers that don't support CSP.
  xFrameOptions: { action: 'deny' },

  // Referrer-Policy: no-referrer — API requests should never leak the
  // Referer header to third-party services (e.g. Supabase, Cloudinary).
  referrerPolicy: { policy: 'no-referrer' },

  // X-DNS-Prefetch-Control: off — no benefit for an API, and disabling it
  // prevents the browser from pre-resolving hostnames found in responses.
  dnsPrefetchControl: { allow: false },

  // Permissions-Policy (formerly Feature-Policy): explicitly disable browser
  // features that an API server will never use.
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },

  // Cross-Origin-Opener-Policy: isolate this origin from other browsing
  // contexts opened from it.
  crossOriginOpenerPolicy: { policy: 'same-origin' },

  // Cross-Origin-Resource-Policy: only allow same-origin fetches.
  // Prevents other origins from embedding API responses.
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));        // tightened from 50mb — files go via multipart
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// PostHog: reads x-posthog-session-id and x-posthog-distinct-id headers from the frontend
setupExpressRequestContext(posthog, app);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api', generalLimiter);                  // broad safety net on all API routes
app.use('/api/auth', authLimiter);                // tighter limit on auth (brute-force)
// uploadLimiter is applied per-route in demands.js (only on the POST endpoint)

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/services', require('./routes/services'));
app.use('/api/demands', require('./routes/demands'));
app.use('/api/nurse', require('./routes/nurse'));
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// PostHog: capture Express errors to error tracking (register after routes)
setupExpressErrorHandler(posthog, app);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const start = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();