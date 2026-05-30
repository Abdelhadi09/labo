const express = require('express');
const { getPool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/services
router.get('/', authenticate, async (req, res) => {
  try {
    const supabase = getPool();
    const { data, error } = await supabase
      .from('analysis_services')
      .select('id, code, name, description, price')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

module.exports = router;