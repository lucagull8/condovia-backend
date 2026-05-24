const router = require('express').Router();
const Utente = require('../models/Utente');
const Movimento = require('../models/Movimento');
const RichiestaWallet = require('../models/RichiestaWallet');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/wallet — saldo + movimenti dell'admin loggato
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const movimenti = await Movimento.find({ utenteId: req.utente._id })
      .sort({ createdAt: -1 }).lean();

    const enriched = movimenti.map(m => ({
      id: m._id,
      tipo: m.tipo,
      importo: m.importo,
      desc: m.desc,
      condo: '',
      data: new Date(m.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
    }));

    res.json({ saldo: req.utente.saldo || 0, movimenti: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/richieste — le mie richieste di pagamento (per mostrare storico)
router.get('/richieste', requireAuth, requireAdmin, async (req, res) => {
  try {
    const richieste = await RichiestaWallet.find({ utenteId: req.utente._id })
      .select('-ricevutaContent')
      .sort({ createdAt: -1 }).lean();
    res.json(richieste);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/wallet/ricevuta/:id — serve la ricevuta PDF (solo il proprio)
router.get('/ricevuta/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await RichiestaWallet.findOne({ _id: req.params.id, utenteId: req.utente._id });
    if (!r || !r.ricevutaContent) return res.status(404).json({ error: 'Ricevuta non trovata' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${r.ricevutaName || 'ricevuta.pdf'}"`);
    res.send(Buffer.from(r.ricevutaContent, 'base64'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/wallet/richiedi — admin richiede pagamento del saldo
// Il saldo NON viene detratto ora: viene detratto dal backoffice al momento del pagamento
router.post('/richiedi', requireAuth, requireAdmin, async (req, res) => {
  try {
    const saldo = req.utente.saldo || 0;
    const importo = parseFloat(req.body.importo);

    if (!importo || isNaN(importo)) return res.status(400).json({ error: 'Importo non valido' });
    if (importo < 50) return res.status(400).json({ error: 'Importo minimo: € 50,00' });
    if (importo > saldo) return res.status(400).json({ error: `Importo massimo disponibile: € ${saldo.toFixed(2)}` });

    const richiesta = await RichiestaWallet.create({
      utenteId: req.utente._id,
      importo: parseFloat(importo.toFixed(2)),
      stato: 'in_attesa',
    });

    res.json({ ok: true, richiesta: { _id: richiesta._id, importo: richiesta.importo, stato: richiesta.stato } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
