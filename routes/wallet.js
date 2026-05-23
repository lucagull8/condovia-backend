const router = require('express').Router();
const Utente = require('../models/Utente');
const Movimento = require('../models/Movimento');
const Condominio = require('../models/Condominio');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/wallet — saldo + movimenti dell'admin loggato
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const movimenti = await Movimento.find({ utenteId: req.utente._id })
      .sort({ createdAt: -1 }).lean();

    // Enrich con nome condominio
    const enriched = [];
    for (const m of movimenti) {
      enriched.push({
        id: m._id,
        tipo: m.tipo,
        importo: m.importo,
        desc: m.desc,
        condo: '',
        data: new Date(m.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
      });
    }

    res.json({ saldo: req.utente.saldo || 0, movimenti: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/richiedi — admin richiede il pagamento del saldo
router.post('/richiedi', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { importo } = req.body;
    if (!importo || importo <= 0) return res.status(400).json({ error: 'Importo non valido' });

    await Movimento.create({
      utenteId: req.utente._id, tipo: 'out',
      importo, desc: 'Richiesta pagamento',
    });

    await Utente.findByIdAndUpdate(req.utente._id, { $inc: { saldo: -importo } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
