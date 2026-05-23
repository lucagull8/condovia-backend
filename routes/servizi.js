const router = require('express').Router();
const Servizio = require('../models/Servizio');
const Contratto = require('../models/Contratto');
const { requireAuth } = require('../middleware/auth');

// GET /api/servizi — all services, enriched with status for the current admin
router.get('/', requireAuth, async (req, res) => {
  try {
    const servizi = await Servizio.find({}).lean();
    const contratti = await Contratto.find({ amministratoreId: req.utente._id }).lean();

    const result = servizi.map(s => {
      const c = contratti.find(c => c.servizioId === s.sid);
      if (!c) return { id: s.sid, label: s.label, titolo: s.titolo, desc: s.desc, color: s.color, bg: s.bg, icon: s.icon, status: 'no', fornitore: null, storno: null, dataScadenza: null, condominioNome: null };

      const now = new Date();
      const scad = new Date(c.dataScadenza);
      const giorniRimasti = Math.ceil((scad - now) / 864e5);
      const status = giorniRimasti <= 30 ? 'scadenza' : 'attivo';

      return {
        id: s.sid, label: s.label, titolo: s.titolo, desc: s.desc, color: s.color, bg: s.bg, icon: s.icon,
        status, fornitore: c.fornitore, storno: c.stornoAmmontare,
        dataInizio: c.dataInizio, dataScadenza: c.dataScadenza,
        condominioNome: null, contrattoId: c._id,
      };
    });

    // populate condominio names
    const Condominio = require('../models/Condominio');
    for (const r of result) {
      if (r.contrattoId) {
        const c = contratti.find(c => c._id.toString() === r.contrattoId.toString());
        if (c?.condominioId) {
          const condo = await Condominio.findById(c.condominioId).lean();
          if (condo) r.condominioNome = condo.nome;
        }
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/servizi/:sid
router.get('/:sid', requireAuth, async (req, res) => {
  try {
    const s = await Servizio.findOne({ sid: req.params.sid }).lean();
    if (!s) return res.status(404).json({ error: 'Servizio non trovato' });

    const c = await Contratto.findOne({ amministratoreId: req.utente._id, servizioId: s.sid }).populate('condominioId', 'nome via citta unita').lean();

    if (!c) return res.json({ id: s.sid, label: s.label, titolo: s.titolo, desc: s.desc, color: s.color, bg: s.bg, icon: s.icon, status: 'no', fornitore: null, storno: null, dataScadenza: null, condominicoperti: [] });

    const now = new Date();
    const giorniRimasti = Math.ceil((new Date(c.dataScadenza) - now) / 864e5);
    const status = giorniRimasti <= 30 ? 'scadenza' : 'attivo';

    res.json({
      id: s.sid, label: s.label, titolo: s.titolo, desc: s.desc, color: s.color, bg: s.bg, icon: s.icon,
      status, fornitore: c.fornitore, storno: c.stornoAmmontare,
      dataInizio: c.dataInizio, dataScadenza: c.dataScadenza,
      pdfUrl: c.pdfUrl || '',
      condominioNome: c.condominioId?.nome,
      condominicoperti: c.condominioId ? [{ _id: c.condominioId._id, nome: c.condominioId.nome, unita: c.condominioId.unita, status }] : [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
