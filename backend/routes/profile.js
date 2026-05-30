const express = require('express');
const { getPool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// PUT /api/profile
router.put('/', authenticate, requireRole('client'), async (req, res) => {
  try {
    const { first_name, last_name, birthday, address, address_lat, address_lng } = req.body;
    if (!first_name || !last_name || !birthday || !address)
      return res.status(400).json({ error: 'All profile fields are required' });

    const supabase = getPool();

    const { data: existing } = await supabase
      .from('client_profiles').select('id').eq('user_id', req.user.id).maybeSingle();

    const payload = { first_name, last_name, birthday, address,
      address_lat: address_lat || null, address_lng: address_lng || null,
      updated_at: new Date().toISOString() };

    if (existing) {
      const { error } = await supabase
        .from('client_profiles').update(payload).eq('user_id', req.user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('client_profiles').insert({ ...payload, user_id: req.user.id });
      if (error) throw error;
    }

    res.json({ message: 'Profile saved successfully' });
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// GET /api/profile
router.get('/', authenticate, requireRole('client'), async (req, res) => {
  try {
    const supabase = getPool();
    const { data, error } = await supabase
      .from('client_profiles').select('*').eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    res.json(data || null);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;