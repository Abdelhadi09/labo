const express = require('express');
const multer = require('multer');
const { body, param, query } = require('express-validator');
const { getPool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { validateImageFile } = require('../middleware/fileValidation');
const { validate } = require('../middleware/validate');
const { uploadOrdonnance } = require('../services/blobStorage');
const { extractTextFromImage, matchServicesFromText } = require('../services/ocrService');

const router = express.Router();

// Normalize the nested demand_items rows returned by Supabase relational select.
const mapItems = (rows) =>
  (rows || []).map(i => ({
    id:         i.id,
    price:      i.price,
    service_id: i.analysis_services?.id,
    name:       i.analysis_services?.name,
    code:       i.analysis_services?.code,
  }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/tiff'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Images only (JPEG, PNG, WEBP, TIFF)'));
  },
});

// ─── POST /api/demands ────────────────────────────────────────────────────────
const createDemandValidation = [
  body('ordonnance_type')
    .trim()
    .isIn(['ocr', 'handwritten', 'manual']).withMessage('ordonnance_type must be "ocr", "handwritten" or "manual"'),

  // service_ids arrives either as a real array (application/json) or as a
  // JSON-encoded string (multipart form field). Validate format here; the
  // route handler still does the authoritative per-id DB lookup.
  body('service_ids')
    .optional()
    .custom((value) => {
      let ids = value;
      if (typeof value === 'string') {
        try {
          ids = JSON.parse(value);
        } catch {
          throw new Error('service_ids must be a valid JSON array');
        }
      }
      if (!Array.isArray(ids) || ids.length === 0)
        throw new Error('service_ids must be a non-empty array');
      if (ids.length > 50)
        throw new Error('service_ids cannot contain more than 50 items');
      if (!ids.every(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))
        throw new Error('service_ids must contain only valid UUIDs');
      return true;
    }),
];

router.post('/', authenticate, requireRole('client'), uploadLimiter, upload.single('ordonnance'), validateImageFile, createDemandValidation, validate, async (req, res) => {
  try {
    const { ordonnance_type, service_ids } = req.body;

    if (ordonnance_type !== 'manual' && !req.file)
      return res.status(400).json({ error: 'Ordonnance file is required' });

    const supabase = getPool();

    // Verify client has a profile
    const { data: profile } = await supabase
      .from('client_profiles').select('id').eq('user_id', req.user.id).maybeSingle();
    if (!profile)
      return res.status(400).json({ error: 'Please complete your profile before submitting' });

    // ── Manual mode ────────────────────────────────────────────────────────
    if (ordonnance_type === 'manual') {
      if (!service_ids) return res.status(400).json({ error: 'service_ids is required for manual submission' });

      const ids = Array.isArray(service_ids) ? service_ids : JSON.parse(service_ids);
      let totalPrice = 0;
      const selectedServices = [];

      for (const serviceId of ids) {
        const { data: svc, error } = await supabase
          .from('analysis_services').select('*').eq('id', serviceId).eq('is_active', true).single();
        if (error || !svc) return res.status(400).json({ error: `Service ${serviceId} not found` });
        selectedServices.push(svc);
        totalPrice += parseFloat(svc.price);
      }

      const { data: demand, error: demandErr } = await supabase
        .from('demands')
        .insert({ client_id: req.user.id, ordonnance_url: 'manual', ordonnance_type: 'manual',
          status: 'processed', total_price: totalPrice })
        .select('id').single();
      if (demandErr) throw demandErr;

      for (const svc of selectedServices) {
        await supabase.from('demand_items')
          .insert({ demand_id: demand.id, service_id: svc.id, price: svc.price });
      }

      return res.status(201).json({
        id: demand.id, status: 'processed', ordonnance_type: 'manual',
        matched_services: selectedServices.map(s => ({ id: s.id, name: s.name, price: s.price })),
        total_price: totalPrice,
        message: `Demande enregistrée. Total: ${totalPrice} DA`,
      });
    }

    // ── File upload ────────────────────────────────────────────────────────
    const fileUrl = await uploadOrdonnance(req.file.buffer, req.file.originalname, req.file.mimetype);

    let ocrText = null;
    let matchedServices = [];
    let totalPrice = null;
    let status = 'pending';

    if (ordonnance_type === 'ocr') {
      ocrText = await extractTextFromImage(req.file.buffer);

      const { data: allServices } = await supabase
        .from('analysis_services').select('*').eq('is_active', true);

      matchedServices = matchServicesFromText(ocrText, allServices || []);
      totalPrice = matchedServices.reduce((sum, s) => sum + parseFloat(s.price), 0);
      status = matchedServices.length > 0 ? 'ocr_processed' : 'ocr_no_match';
    }

    const { data: demand, error: demandErr } = await supabase
      .from('demands')
      .insert({ client_id: req.user.id, ordonnance_url: fileUrl, ordonnance_type,
        status, ocr_text: ocrText, total_price: totalPrice })
      .select('id').single();
    if (demandErr) throw demandErr;

    for (const svc of matchedServices) {
      await supabase.from('demand_items')
        .insert({ demand_id: demand.id, service_id: svc.id, price: svc.price });
    }

    res.status(201).json({
      id: demand.id, status, ordonnance_type,
      matched_services: matchedServices.map(s => ({ id: s.id, name: s.name, price: s.price })),
      total_price: totalPrice, ocr_text: ocrText,
      message: ordonnance_type === 'ocr'
        ? matchedServices.length > 0
          ? `Trouvé ${matchedServices.length} analyse(s). Total: ${totalPrice} DA`
          : "Aucune analyse reconnue. Un technicien va examiner l'ordonnance."
        : 'Ordonnance soumise. Un technicien la traitera sous peu.',
    });
  } catch (err) {
    console.error('Submit demand error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit demand' });
  }
});

// ─── GET /api/demands ─────────────────────────────────────────────────────────
// Query params: page (1-based, default 1), limit (default 20, max 100)
const listDemandsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

router.get('/', authenticate, listDemandsValidation, validate, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

    const supabase = getPool();
    let query;

    if (req.user.role === 'worker') {
      query = supabase
        .from('demands')
        .select(
          `*, demand_items(id, price, analysis_services(id, name, code)),
           users(username, client_profiles(first_name, last_name, birthday, address))`,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(from, to);
    } else {
      query = supabase
        .from('demands')
        .select('*, demand_items(id, price, analysis_services(id, name, code))', { count: 'exact' })
        .eq('client_id', req.user.id)
        .order('created_at', { ascending: false })
        .range(from, to);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    let demands;
    if (req.user.role === 'worker') {
      demands = (data || []).map(d => ({
        ...d,
        username:   d.users?.username,
        first_name: d.users?.client_profiles?.[0]?.first_name,
        last_name:  d.users?.client_profiles?.[0]?.last_name,
        birthday:   d.users?.client_profiles?.[0]?.birthday,
        address:    d.users?.client_profiles?.[0]?.address,
        items:      mapItems(d.demand_items),
      }));
    } else {
      demands = (data || []).map(d => ({ ...d, items: mapItems(d.demand_items) }));
    }

    res.json({
      data:        demands,
      total:       count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    console.error('Get demands error:', err);
    res.status(500).json({ error: 'Failed to fetch demands' });
  }
});

// ─── GET /api/demands/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, param('id').isUUID().withMessage('id must be a valid UUID'), validate, async (req, res) => {
  try {
    const supabase = getPool();
    let demand;

    if (req.user.role === 'worker') {
      const { data, error } = await supabase
        .from('demands')
        .select(`*, demand_items(id, price, analysis_services(id, name, code)), users(username), client_profiles(first_name, last_name, birthday, address)`)
        .eq('id', req.params.id).single();
      if (error || !data) return res.status(404).json({ error: 'Demand not found' });
      demand = {
        ...data,
        username:   data.users?.username,
        first_name: data.client_profiles?.first_name,
        last_name:  data.client_profiles?.last_name,
        birthday:   data.client_profiles?.birthday,
        address:    data.client_profiles?.address,
        items:      mapItems(data.demand_items),
      };
    } else {
      const { data, error } = await supabase
        .from('demands').select('*, demand_items(id, price, analysis_services(id, name, code))')
        .eq('id', req.params.id).eq('client_id', req.user.id).single();
      if (error || !data) return res.status(404).json({ error: 'Demand not found' });
      demand = { ...data, items: mapItems(data.demand_items) };
    }

    res.json(demand);
  } catch (err) {
    console.error('Get demand error:', err);
    res.status(500).json({ error: 'Failed to fetch demand' });
  }
});

// ─── PUT /api/demands/:id/process ─────────────────────────────────────────────
const processDemandValidation = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
  body('service_ids')
    .isArray({ min: 1, max: 50 }).withMessage('service_ids array is required (1-50 items)'),
  body('service_ids.*')
    .isUUID().withMessage('Each service id must be a valid UUID'),
  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('notes must be 1000 characters or fewer'),
];

router.put('/:id/process', authenticate, requireRole('worker'), processDemandValidation, validate, async (req, res) => {
  try {
    const { service_ids, notes } = req.body;

    const supabase = getPool();

    const { data: demand, error: demandErr } = await supabase
      .from('demands').select('*').eq('id', req.params.id).single();
    if (demandErr || !demand) return res.status(404).json({ error: 'Demand not found' });

    if (!['pending','ocr_no_match'].includes(demand.status))
      return res.status(400).json({ error: 'Demand has already been processed' });

    let totalPrice = 0;
    const selectedServices = [];

    for (const serviceId of service_ids) {
      const { data: svc, error } = await supabase
        .from('analysis_services').select('*').eq('id', serviceId).eq('is_active', true).single();
      if (error || !svc) return res.status(400).json({ error: `Service ${serviceId} not found` });
      totalPrice += parseFloat(svc.price);
      selectedServices.push(svc);
    }

    // Remove old items then insert new ones
    await supabase.from('demand_items').delete().eq('demand_id', demand.id);
    for (const svc of selectedServices) {
      await supabase.from('demand_items')
        .insert({ demand_id: demand.id, service_id: svc.id, price: svc.price });
    }

    const { error: updateErr } = await supabase.from('demands')
      .update({ status: 'processed', total_price: totalPrice,
        notes: notes || null, updated_at: new Date().toISOString() })
      .eq('id', demand.id);
    if (updateErr) throw updateErr;

    res.json({
      message: 'Demand processed successfully',
      total_price: totalPrice,
      services: selectedServices.map(s => ({ id: s.id, name: s.name, price: s.price })),
    });
  } catch (err) {
    console.error('Process demand error:', err);
    res.status(500).json({ error: 'Failed to process demand' });
  }
});

module.exports = router;