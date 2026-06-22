const express = require('express');
const { body, param } = require('express-validator');
const { getPool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Algerian-style or generic international phone numbers: optional leading +,
// 8-15 digits, allowing spaces/dashes/parens for readability.
const PHONE_REGEX = /^\+?[0-9\s().-]{8,20}$/;

const nurseRequestValidation = [
  body('demand_id')
    .trim()
    .notEmpty().withMessage('demand_id is required')
    .isUUID().withMessage('demand_id must be a valid UUID'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone is required')
    .isLength({ max: 20 }).withMessage('Phone must be 20 characters or fewer')
    .matches(PHONE_REGEX).withMessage('Phone number format is invalid'),

  body('address')
    .trim()
    .notEmpty().withMessage('Address is required')
    .isLength({ max: 500 }).withMessage('Address must be 500 characters or fewer'),

  body('address_lat')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: -90, max: 90 }).withMessage('address_lat must be between -90 and 90'),

  body('address_lng')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: -180, max: 180 }).withMessage('address_lng must be between -180 and 180'),
];

// POST /api/nurse — client requests a nurse visit
router.post('/', authenticate, requireRole('client'), nurseRequestValidation, validate, async (req, res) => {
  try {
    const { demand_id, phone, address, address_lat, address_lng } = req.body;

    const supabase = getPool();

    // Verify demand belongs to this client and is processed
    const { data: demand, error: demandErr } = await supabase
      .from('demands').select('id, status, client_id')
      .eq('id', demand_id).eq('client_id', req.user.id).single();

    if (demandErr || !demand)
      return res.status(404).json({ error: 'Demande introuvable' });

    if (!['processed', 'ocr_processed'].includes(demand.status))
      return res.status(400).json({ error: 'La demande doit être traitée avant de demander une infirmière' });

    // Check not already requested
    const { data: existing } = await supabase
      .from('nurse_requests').select('id')
      .eq('demand_id', demand_id).maybeSingle();

    if (existing)
      return res.status(409).json({ error: "Une demande d'infirmière existe déjà pour cette analyse" });

    const { data, error } = await supabase
      .from('nurse_requests')
      .insert({ demand_id, client_id: req.user.id, phone, address,
        address_lat: address_lat || null, address_lng: address_lng || null })
      .select('id').single();

    if (error) throw error;
    res.status(201).json({ id: data.id, message: "Demande d'infirmière soumise avec succès" });
  } catch (err) {
    console.error('Nurse request error:', err);
    res.status(500).json({ error: 'Erreur lors de la soumission' });
  }
});

// GET /api/nurse — worker sees nurse requests (paginated)
// Query params: page (1-based, default 1), limit (default 20, max 100)
router.get('/', authenticate, requireRole('worker'), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

    const supabase = getPool();

    const { data, error, count } = await supabase
      .from('nurse_requests')
      .select(
        `*,
         demands(id, ordonnance_type, total_price, status,
           demand_items(price, analysis_services(name)),
           users(username, client_profiles(first_name, last_name))
         )`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const result = (data || []).map(r => ({
      ...r,
      demand_total: r.demands?.total_price,
      demand_type:  r.demands?.ordonnance_type,
      username:     r.demands?.users?.username,
      first_name:   r.demands?.users?.client_profiles?.[0]?.first_name,
      last_name:    r.demands?.users?.client_profiles?.[0]?.last_name,
      analyses:     (r.demands?.demand_items || []).map(i => i.analysis_services?.name).filter(Boolean),
    }));

    res.json({
      data:        result,
      total:       count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    console.error('Get nurse requests error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// PUT /api/nurse/:id/status — worker updates status
const nurseStatusValidation = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
  body('status')
    .trim()
    .isIn(['pending', 'confirmed', 'done']).withMessage('Status invalide'),
];

router.put('/:id/status', authenticate, requireRole('worker'), nurseStatusValidation, validate, async (req, res) => {
  try {
    const { status } = req.body;

    const supabase = getPool();
    const { error } = await supabase
      .from('nurse_requests').update({ status }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Statut mis à jour' });
  } catch (err) {
    console.error('Update nurse status error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

module.exports = router;