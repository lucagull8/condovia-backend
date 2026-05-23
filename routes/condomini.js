const router = require('express').Router();
const Condominio = require('../models/Condominio');
const Contratto = require('../models/Contratto');
const { requireAuth } = require('../middleware/auth');

// GET /api/condomini — all condomini for current admin
router.get('/', requireAuth, async (req, res) => {
  try {
    const condomini = await Condominio.find({ amministratoreId: req.utente._id }).lean();
    const contratti = await Contratto.find({ amministratoreId: req.utente._id }).lean();

    const result = condomini.map(c => {
      const contrattiCondo = contratti.filter(ct => ct.condominioId?.toString() === c._id.toString());
      const now = new Date();
      let attivi = 0, scadenze = 0, storno = 0;
      for (const ct of contrattiCondo) {
        const days = Math.ceil((new Date(ct.dataScadenza) - now) / 864e5);
        if (days <= 30) scadenze++; else attivi++;
        storno += ct.stornoAmmontare || 0;
      }
      return { ...c, attivi, scadenze, storno: Math.round(storno) };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/condomini — admin aggiunge un nuovo condominio
router.post('/', requireAuth, async (req, res) => {
  try {
    const { nome, via, citta, unita } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome condominio obbligatorio' });
    const condo = await Condominio.create({
      nome: nome.trim(),
      via: (via || '').trim(),
      citta: (citta || '').trim(),
      unita: parseInt(unita) || 0,
      amministratoreId: req.utente._id,
    });
    res.status(201).json(condo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/condomini/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const c = await Condominio.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ error: 'Condominio non trovato' });

    const contratti = await Contratto.find({ condominioId: c._id }).lean();
    const now = new Date();
    let attivi = 0, scadenze = 0, storno = 0;
    const servizi = {};
    for (const ct of contratti) {
      const days = Math.ceil((new Date(ct.dataScadenza) - now) / 864e5);
      const stato = days <= 30 ? 'scadenza' : 'attivo';
      if (stato === 'scadenza') scadenze++; else attivi++;
      storno += ct.stornoAmmontare || 0;
      servizi[ct.servizioId] = stato;
    }

    res.json({ ...c, attivi, scadenze, storno: Math.round(storno), servizi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
