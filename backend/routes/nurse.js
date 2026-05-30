const express = require('express');
const { getPool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/nurse — client requests a nurse visit
router.post('/', authenticate, requireRole('client'), async (req, res) => {
  try {
    const { demand_id, phone, address, address_lat, address_lng } = req.body;
    if (!demand_id || !phone || !address)
      return res.status(400).json({ error: 'demand_id, phone and address are required' });

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
      return res.status(409).json({ error: 'Une demande d\'infirmière existe déjà pour cette analyse' });

    const { data, error } = await supabase
      .from('nurse_requests')
      .insert({ demand_id, client_id: req.user.id, phone, address,
        address_lat: address_lat || null, address_lng: address_lng || null })
      .select('id').single();

    if (error) throw error;
    res.status(201).json({ id: data.id, message: 'Demande d\'infirmière soumise avec succès' });
  } catch (err) {
    console.error('Nurse request error:', err);
    res.status(500).json({ error: 'Erreur lors de la soumission' });
  }
});

// GET /api/nurse — worker sees all nurse requests
router.get('/', authenticate, requireRole('worker'), async (req, res) => {
  try {
    const supabase = getPool();

    const { data, error } = await supabase
      .from('nurse_requests')
      .select(`
        *,
        demands(id, ordonnance_type, total_price, status,
          demand_items(price, analysis_services(name)),
          users(username, client_profiles(first_name, last_name))
        )
      `)
      .order('created_at', { ascending: false });

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

    res.json(result);
  } catch (err) {
    console.error('Get nurse requests error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// PUT /api/nurse/:id/status — worker updates status
router.put('/:id/status', authenticate, requireRole('worker'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'done'].includes(status))
      return res.status(400).json({ error: 'Status invalide' });

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