const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * WORKER LOGIN — username + password → our custom JWT
 * POST /api/auth/worker/login
 */
router.post('/worker/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });

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

    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'worker' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: 'worker' } });
  } catch (err) {
    console.error('Worker login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * CLIENT SESSION VERIFY — called after Supabase client-side auth
 * POST /api/auth/client/session
 * Body: { supabase_access_token }
 * Returns our own enriched user object (creates DB record if first login)
 */
router.post('/client/session', async (req, res) => {
  try {
    const { supabase_access_token } = req.body;
    if (!supabase_access_token)
      return res.status(400).json({ error: 'supabase_access_token required' });

    const supabase = getPool();

    // Verify the Supabase token and get the user
    const { data: { user: sbUser }, error } = await supabase.auth.getUser(supabase_access_token);
    if (error || !sbUser)
      return res.status(401).json({ error: 'Invalid Supabase token' });

    // Upsert into our users table (id = supabase auth user id).
    // Using upsert with onConflict is atomic — no race condition if the user
    // signs in twice in quick succession (e.g. double-tab on Google redirect).
    const identifier = sbUser.email || sbUser.id;
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: sbUser.id,
          username: identifier,
          password: '', // no password for OAuth/OTP clients
          role: 'client',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (upsertError) {
      console.error('Failed to upsert user record:', upsertError);
      return res.status(500).json({ error: 'Failed to create user record' });
    }

    // Issue our own JWT so the rest of the API stays unchanged
    const token = jwt.sign(
      { id: sbUser.id, username: identifier, role: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: { id: sbUser.id, username: identifier, role: 'client', email: sbUser.email },
    });
  } catch (err) {
    console.error('Client session error:', err);
    res.status(500).json({ error: 'Session verification failed' });
  }
});

/**
 * GET /api/auth/me — works for both worker (JWT) and client (JWT)
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