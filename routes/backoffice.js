const router = require('express').Router();
const Utente = require('../models/Utente');
const Contratto = require('../models/Contratto');
const Condominio = require('../models/Condominio');
const Richiesta = require('../models/Richiesta');
const Movimento = require('../models/Movimento');
const Fatturazione = require('../models/Fatturazione');
const Servizio = require('../models/Servizio');
const upload = require('../middleware/upload');
const { requireAuth, requireCommerciale } = require('../middleware/auth');

router.use(requireAuth, requireCommerciale);

// ═══════════════════════════════════════════════════════════
// SERVIZI CATALOGO (con commissioni)
// ═══════════════════════════════════════════════════════════
router.get('/servizi', async (req, res) => {
  try {
    const servizi = await Servizio.find({}).lean();
    res.json(servizi);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// CONDOMINI PER ADMIN (dal backoffice)
// ═══════════════════════════════════════════════════════════
router.get('/condomini/:adminId', async (req, res) => {
  try {
    const condomini = await Condominio.find({ amministratoreId: req.params.adminId }).lean();
    res.json(condomini);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD KPI
// ═══════════════════════════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  try {
    const contrattiAttivi = await Contratto.countDocuments({ stato: { $in: ['attivo', 'scadenza'] } });
    const agg = await Contratto.aggregate([
      { $match: { stato: { $in: ['attivo', 'scadenza'] } } },
      { $group: { _id: null, margine: { $sum: '$margineCondovia' }, storno: { $sum: '$stornoAmmontare' } } },
    ]);
    const m = agg[0] || { margine: 0, storno: 0 };
    const richiesteInAttesa = await Richiesta.countDocuments({ stato: 'in_attesa' });
    const iscrizioniPending = await Utente.countDocuments({ stato: 'pending' });
    const totAmministratori = await Utente.countDocuments({ ruolo: 'amministratore', stato: 'attivo' });

    res.json({
      contrattiAttivi,
      margineMese: parseFloat(m.margine.toFixed(2)),
      stornoMese: parseFloat(m.storno.toFixed(2)),
      richiesteInAttesa,
      iscrizioniPending,
      totAmministratori,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// AMMINISTRATORI
// ═══════════════════════════════════════════════════════════
router.get('/admin', async (req, res) => {
  try {
    const admins = await Utente.find({ ruolo: 'amministratore', stato: 'attivo' }).select('-password').lean();
    const result = [];
    for (const a of admins) {
      const condomini = await Condominio.countDocuments({ amministratoreId: a._id });
      const contratti = await Contratto.find({ amministratoreId: a._id, stato: { $in: ['attivo', 'scadenza'] } }).lean();
      const stornoTotale = contratti.reduce((s, c) => s + (c.stornoAmmontare || 0), 0);
      result.push({ ...a, condomini, serviziAttivi: contratti.length, stornoTotale });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/:id', async (req, res) => {
  try {
    const a = await Utente.findById(req.params.id).select('-password').lean();
    if (!a) return res.status(404).json({ error: 'Amministratore non trovato' });
    const condomini = await Condominio.find({ amministratoreId: a._id }).lean();
    const contratti = await Contratto.find({ amministratoreId: a._id }).populate('condominioId', 'nome').lean();
    const movimenti = await Movimento.find({ utenteId: a._id }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ ...a, condomini, contratti, movimenti });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// CONTRATTI — lista + creazione (con PDF + calcolo margine + accredito wallet)
// ═══════════════════════════════════════════════════════════
router.get('/contratti', async (req, res) => {
  try {
    const contratti = await Contratto.find({})
      .populate('amministratoreId', 'nome cognome studio email')
      .populate('condominioId', 'nome via citta')
      .sort({ createdAt: -1 }).lean();
    res.json(contratti);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/contratti', upload.single('pdf'), async (req, res) => {
  try {
    const { amministratoreId, condominioId, servizioId, fornitore, prezzo, stornoTipo, stornoValore, dataInizio, dataScadenza, richiestaId } = req.body;

    if (!amministratoreId || !condominioId || !servizioId || !fornitore || !prezzo || !dataInizio || !dataScadenza) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    const prezzoNum = parseFloat(prezzo);
    const stornoVal = parseFloat(stornoValore) || 0;

    // Commissione per-servizio (dal catalogo)
    const serv = await Servizio.findOne({ sid: servizioId });
    const commPct = serv ? serv.commissionePct : 0.15;
    const commissione = prezzoNum * commPct;

    let stornoAmm = stornoTipo === 'pct' ? (prezzoNum * stornoVal / 100) : stornoVal;
    const margine = commissione - stornoAmm;

    const contratto = await Contratto.create({
      amministratoreId, condominioId, servizioId, fornitore,
      prezzo: prezzoNum, stornoTipo: stornoTipo || 'fix',
      stornoValore: stornoVal, stornoAmmontare: parseFloat(stornoAmm.toFixed(2)),
      margineCondovia: parseFloat(margine.toFixed(2)),
      dataInizio: new Date(dataInizio), dataScadenza: new Date(dataScadenza),
      stato: 'attivo', pdfUrl: req.file ? `/uploads/${req.file.filename}` : '',
      richiestaId: richiestaId || undefined,
    });

    // Accredita storno nel wallet dell'admin
    if (stornoAmm > 0) {
      await Movimento.create({
        utenteId: amministratoreId, tipo: 'in',
        importo: parseFloat(stornoAmm.toFixed(2)),
        desc: `Storno ${serv ? serv.label : servizioId}`,
        contrattoId: contratto._id,
      });
      await Utente.findByIdAndUpdate(amministratoreId, { $inc: { saldo: parseFloat(stornoAmm.toFixed(2)) } });
    }

    // Aggiorna richiesta se presente
    if (richiestaId) {
      await Richiesta.findByIdAndUpdate(richiestaId, { stato: 'contratto_caricato' });
    }

    res.status(201).json(contratto);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// RICHIESTE — gestione dal backoffice
// ═══════════════════════════════════════════════════════════
router.get('/richieste', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.stato) filtro.stato = req.query.stato;
    const richieste = await Richiesta.find(filtro)
      .populate('amministratoreId', 'nome cognome studio email')
      .populate('condominioId', 'nome via citta')
      .sort({ createdAt: -1 }).lean();
    res.json(richieste);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/richieste/:id', async (req, res) => {
  try {
    const update = {};
    if (req.body.stato) update.stato = req.body.stato;
    if (req.body.notaInterna) update.notaInterna = req.body.notaInterna;
    const r = await Richiesta.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!r) return res.status(404).json({ error: 'Richiesta non trovata' });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// MARGINI — aggregazione per servizio
// ═══════════════════════════════════════════════════════════
router.get('/margini', async (req, res) => {
  try {
    const margini = await Contratto.aggregate([
      { $match: { stato: { $in: ['attivo', 'scadenza'] } } },
      {
        $group: {
          _id: '$servizioId',
          numContratti: { $sum: 1 },
          totalePrezzo: { $sum: '$prezzo' },
          totaleStorno: { $sum: '$stornoAmmontare' },
          totaleMargine: { $sum: '$margineCondovia' },
        },
      },
      { $sort: { totaleMargine: -1 } },
    ]);

    const totali = margini.reduce((acc, m) => ({
      prezzo: acc.prezzo + m.totalePrezzo,
      storno: acc.storno + m.totaleStorno,
      margine: acc.margine + m.totaleMargine,
      contratti: acc.contratti + m.numContratti,
    }), { prezzo: 0, storno: 0, margine: 0, contratti: 0 });

    res.json({ margini, totali });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// ISCRIZIONI — approvazione / rifiuto nuovi admin
// ═══════════════════════════════════════════════════════════
router.get('/iscrizioni', async (req, res) => {
  try {
    const stato = req.query.stato || 'pending';
    const utenti = await Utente.find({ ruolo: 'amministratore', stato }).select('-password').sort({ createdAt: -1 }).lean();
    res.json(utenti);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/iscrizioni/:id/approva', async (req, res) => {
  try {
    const u = await Utente.findByIdAndUpdate(req.params.id, { stato: 'attivo' }, { new: true }).select('-password');
    if (!u) return res.status(404).json({ error: 'Utente non trovato' });
    res.json(u);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/iscrizioni/:id/rifiuta', async (req, res) => {
  try {
    const u = await Utente.findByIdAndUpdate(req.params.id, { stato: 'rifiutato' }, { new: true }).select('-password');
    if (!u) return res.status(404).json({ error: 'Utente non trovato' });
    res.json(u);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// FATTURAZIONE
// ═══════════════════════════════════════════════════════════
router.get('/fatturazione', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.stato) filtro.stato = req.query.stato;
    const fatture = await Fatturazione.find(filtro)
      .populate('amministratoreId', 'nome cognome studio email')
      .populate('condominioId', 'nome')
      .sort({ createdAt: -1 }).lean();

    const tutte = await Fatturazione.find({}).lean();
    const stats = {
      inAttesa: tutte.filter(f => f.stato === 'in_attesa').length,
      elaborazione: tutte.filter(f => f.stato === 'elaborazione').length,
      valoreInAttesa: tutte.filter(f => f.stato === 'in_attesa').reduce((a, f) => a + f.importo, 0),
      valoreTotale: tutte.reduce((a, f) => a + f.importo, 0),
    };
    res.json({ fatture, stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/fatturazione/:id', async (req, res) => {
  try {
    const f = await Fatturazione.findById(req.params.id);
    if (!f) return res.status(404).json({ error: 'Fattura non trovata' });
    if (req.body.stato) f.stato = req.body.stato;
    await f.save();
    res.json(f);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// SEED-RESET — protetto: solo se LOAD_DEMO=true e non production
// ═══════════════════════════════════════════════════════════
router.post('/seed-reset', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.LOAD_DEMO !== 'true') {
    return res.status(403).json({ error: 'Operazione non consentita in questo ambiente' });
  }
  try {
    await Contratto.deleteMany({});
    await Richiesta.deleteMany({});
    await Movimento.deleteMany({});
    await Fatturazione.deleteMany({});
    await Condominio.deleteMany({});
    await Utente.deleteMany({ ruolo: { $ne: 'commerciale' } });
    res.json({ ok: true, message: 'Dati resettati (servizi e commerciale preservati)' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
