const router = require('express').Router();
const Richiesta = require('../models/Richiesta');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// POST /api/richieste — admin crea richiesta servizio
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { condominioId, servizioId, note } = req.body;
    if (!servizioId) return res.status(400).json({ error: 'servizioId richiesto' });
    const richiesta = await Richiesta.create({
      amministratoreId: req.utente._id,
      condominioId: condominioId || undefined,
      servizioId, note: note || '',
    });
    res.status(201).json(richiesta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
