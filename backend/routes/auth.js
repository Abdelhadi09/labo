const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { getPool }    = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate }   = require('../middleware/validate');
const posthog = require('../config/posthog');

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hash a refresh token before storing.
 * We store SHA-256(token) so a DB breach doesn't expose usable tokens.
 */
const hashToken = (raw) =>
  crypto.createHash('sha256').update(raw).digest('hex');

/**
 * Issue an access token + a refresh token, persist the refresh token,
 * and return both to the caller.
 *
 * @param {object} payload   – { id, username, role } for the access token
 * @param {string} familyId  – pass an existing family UUID on rotation,
 *                             or omit/null to start a new family
 */
const issueTokenPair = async (payload, familyId = null) => {
  const supabase = getPool();

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

  // Raw refresh token — 32 random bytes, base64url encoded → 43 chars, no padding issues
  const rawRefresh  = crypto.randomBytes(32).toString('base64url');
  const tokenHash   = hashToken(rawRefresh);
  const family      = familyId ?? uuidv4();
  const expiresAt   = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

  const { error } = await supabase.from('refresh_tokens').insert({
    user_id:    payload.id,
    token_hash: tokenHash,
    family_id:  family,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to store refresh token: ${error.message}`);

  return { accessToken, refreshToken: rawRefresh };
};

// ─── Validation schemas ───────────────────────────────────────────────────────

const workerLoginValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username and password are required')
    .isLength({ max: 100 }).withMessage('Username must be 100 characters or fewer'),
  body('password')
    .notEmpty().withMessage('Username and password are required')
    .isLength({ max: 200 }).withMessage('Password must be 200 characters or fewer'),
];

const clientSessionValidation = [
  body('supabase_access_token')
    .trim()
    .notEmpty().withMessage('supabase_access_token required')
    .isLength({ max: 4096 }).withMessage('supabase_access_token is too long'),
];

const refreshValidation = [
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('refreshToken required')
    // base64url 32 bytes = exactly 43 chars; reject anything wildly off
    .isLength({ min: 40, max: 60 }).withMessage('Invalid refresh token format'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/worker/login
 * username + password → access token + refresh token
 */
router.post('/worker/login', workerLoginValidation, validate, async (req, res) => {
  try {
    const { username, password } = req.body;
    const supabase = getPool();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, role')
      .eq('username', username)
      .eq('role', 'worker')
      .maybeSingle();

    if (error || !user)
      return res.status(401).json({ error: 'Identifiants invalides' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Identifiants invalides' });

    const payload = { id: user.id, username: user.username, role: 'worker' };
    const { accessToken, refreshToken } = await issueTokenPair(payload);

    posthog.identify({
      distinctId: user.id,
      properties: { username: user.username, role: 'worker' },
    });
    posthog.capture({
      distinctId: user.id,
      event: 'worker_logged_in',
      properties: { username: user.username },
    });

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, role: 'worker' },
    });
  } catch (err) {
    console.error('Worker login error:', err);
    posthog.captureException(err, undefined, { endpoint: '/api/auth/worker/login' });
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/client/session
 * Verifies a Supabase access token, upserts the user record, and issues
 * our own access + refresh tokens.
 */
router.post('/client/session', clientSessionValidation, validate, async (req, res) => {
  try {
    const { supabase_access_token } = req.body;
    const supabase = getPool();

    const { data: { user: sbUser }, error } = await supabase.auth.getUser(supabase_access_token);
    if (error || !sbUser)
      return res.status(401).json({ error: 'Invalid Supabase token' });

    const identifier = sbUser.email || sbUser.id;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', sbUser.id)
      .maybeSingle();
    const isNewUser = !existingUser;

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        { id: sbUser.id, username: identifier, password: '', role: 'client' },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (upsertError) {
      console.error('Failed to upsert user record:', upsertError);
      return res.status(500).json({ error: 'Failed to create user record' });
    }

    const payload = { id: sbUser.id, username: identifier, role: 'client' };
    const { accessToken, refreshToken } = await issueTokenPair(payload);

    posthog.identify({
      distinctId: sbUser.id,
      properties: {
        email: sbUser.email,
        username: identifier,
        role: 'client',
        $set_once: { first_login: new Date().toISOString() },
      },
    });

    if (isNewUser) {
      posthog.capture({
        distinctId: sbUser.id,
        event: 'client_registered',
        properties: { email: sbUser.email, auth_provider: sbUser.app_metadata?.provider || 'email' },
      });
    }

    posthog.capture({
      distinctId: sbUser.id,
      event: 'client_session_created',
      properties: { role: 'client', is_new_user: isNewUser },
    });

    res.json({
      accessToken,
      refreshToken,
      user: { id: sbUser.id, username: identifier, role: 'client', email: sbUser.email },
    });
  } catch (err) {
    console.error('Client session error:', err);
    posthog.captureException(err, undefined, { endpoint: '/api/auth/client/session' });
    res.status(500).json({ error: 'Session verification failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Rotates a refresh token: validates it, revokes it, and issues a fresh pair.
 *
 * Reuse detection: if the presented token was already revoked, the entire
 * family is revoked immediately (someone is replaying a stolen token).
 */
router.post('/refresh', refreshValidation, validate, async (req, res) => {
  const { refreshToken: rawToken } = req.body;
  const supabase = getPool();

  try {
    const tokenHash = hashToken(rawToken);

    // Look up the token — join user so we can rebuild the payload
    const { data: stored, error } = await supabase
      .from('refresh_tokens')
      .select('id, user_id, family_id, expires_at, revoked_at, users(id, username, role)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      console.error('Refresh token lookup error:', error);
      return res.status(500).json({ error: 'Internal error during token refresh' });
    }

    // ── Unknown token ──────────────────────────────────────────────────────
    if (!stored) {
      return res.status(401).json({ error: 'Invalid refresh token', code: 'REFRESH_INVALID' });
    }

    // ── Reuse detected: token already revoked ─────────────────────────────
    // Revoke the entire family — all sessions derived from the same login are
    // compromised. The legitimate user will be forced to log in again.
    if (stored.revoked_at) {
      console.warn(`Refresh token reuse detected — revoking family ${stored.family_id}`);
      await supabase
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('family_id', stored.family_id)
        .is('revoked_at', null);

      return res.status(401).json({ error: 'Token reuse detected — please log in again', code: 'REFRESH_REUSE' });
    }

    // ── Expired ───────────────────────────────────────────────────────────
    if (new Date(stored.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired', code: 'REFRESH_EXPIRED' });
    }

    // ── Valid — rotate ────────────────────────────────────────────────────
    // Mark old token revoked first (before issuing new one) to prevent
    // a TOCTOU race where two requests use the same token simultaneously.
    const { error: revokeError } = await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', stored.id);

    if (revokeError) {
      console.error('Failed to revoke old refresh token:', revokeError);
      return res.status(500).json({ error: 'Token rotation failed' });
    }

    const user = stored.users;
    const payload = { id: user.id, username: user.username, role: user.role };

    // Continue the same family so reuse detection covers the whole chain
    const { accessToken, refreshToken: newRefreshToken } =
      await issueTokenPair(payload, stored.family_id);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/logout
 * Revokes the presented refresh token (and optionally all sessions for the user).
 * Access token expiry handles itself — 15 m window is acceptable.
 */
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken: rawToken, allDevices = false } = req.body;
  const supabase = getPool();

  try {
    if (allDevices) {
      // "Log out everywhere" — revoke all active refresh tokens for this user
      await supabase
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', req.user.id)
        .is('revoked_at', null);
    } else if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await supabase
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .eq('user_id', req.user.id);   // ensure user can only revoke their own tokens
    }

    posthog.capture({
      distinctId: req.user.id,
      event: 'user_logged_out',
      properties: { all_devices: allDevices },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    // Still return 200 — client should clear tokens regardless
    res.json({ ok: true });
  }
});

/**
 * GET /api/auth/me — works for both worker and client (access token)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const supabase = getPool();
    const { data: user } = await supabase
      .from('users')
      .select('id, username, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: profile } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    res.json({ ...user, ...profile });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;