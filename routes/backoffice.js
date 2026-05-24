const router = require('express').Router();
const Utente = require('../models/Utente');
const Contratto = require('../models/Contratto');
const Condominio = require('../models/Condominio');
const Richiesta = require('../models/Richiesta');
const Movimento = require('../models/Movimento');
const Fatturazione = require('../models/Fatturazione');
const Servizio = require('../models/Servizio');
const DocumentoAdmin = require('../models/DocumentoAdmin');
const RichiestaWallet = require('../models/RichiestaWallet');
const upload = require('../middleware/upload');
const { requireAuth, requireCommerciale } = require('../middleware/auth');

router.use(requireAuth, requireCommerciale);

// ═══════════════════════════════════════════════════════════
// SERVIZI CATALOGO
// ═══════════════════════════════════════════════════════════
router.get('/servizi', async (req, res) => {
  try {
    const servizi = await Servizio.find({}).lean();
    res.json(servizi);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// CONDOMINI PER ADMIN
// ═══════════════════════════════════════════════════════════
router.get('/condomini/:adminId', async (req, res) => {
  try {
    const condomini = await Condominio.find({ amministratoreId: req.params.adminId }).lean();
    res.json(condomini);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Crea condominio per un admin (dal backoffice)
router.post('/condomini/:adminId', async (req, res) => {
  try {
    const { nome, via, citta, unita, codiceFiscale } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obbligatorio' });
    const condo = await Condominio.create({
      nome: nome.trim(),
      via: (via || '').trim(),
      citta: (citta || '').trim(),
      unita: parseInt(unita) || 0,
      codiceFiscale: (codiceFiscale || '').trim(),
      amministratoreId: req.params.adminId,
    });
    res.status(201).json(condo);
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
    const richiesteWalletPending = await RichiestaWallet.countDocuments({ stato: 'in_attesa' });

    res.json({
      contrattiAttivi,
      margineMese: parseFloat(m.margine.toFixed(2)),
      stornoMese: parseFloat(m.storno.toFixed(2)),
      richiesteInAttesa,
      iscrizioniPending,
      totAmministratori,
      richiesteWalletPending,
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
      const richiesteWallet = await RichiestaWallet.countDocuments({ utenteId: a._id, stato: 'in_attesa' });
      result.push({ ...a, condomini, serviziAttivi: contratti.length, stornoTotale, richiesteWalletPending: richiesteWallet });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/:id', async (req, res) => {
  try {
    const a = await Utente.findById(req.params.id).select('-password').lean();
    if (!a) return res.status(404).json({ error: 'Amministratore non trovato' });
    const condomini = await Condominio.find({ amministratoreId: a._id }).lean();
    const contratti = await Contratto.find({ amministratoreId: a._id }).populate('condominioId', 'nome').select('-pdfContent -pods.pdfContent').lean();
    const movimenti = await Movimento.find({ utenteId: a._id }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ ...a, condomini, contratti, movimenti });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// DOCUMENTI ADMIN (nomina assemblea + ultima bolletta)
// ═══════════════════════════════════════════════════════════
router.get('/admin/:id/documenti', async (req, res) => {
  try {
    const docs = await DocumentoAdmin.find({ amministratoreId: req.params.id }).select('-fileContent').lean();
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/:id/documenti', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File mancante' });
    const { tipo, note } = req.body;
    if (!['nomina', 'bolletta'].includes(tipo)) return res.status(400).json({ error: 'Tipo non valido (nomina|bolletta)' });

    const fileData = {
      fileName: req.file.originalname,
      fileContent: req.file.buffer.toString('base64'),
      note: note || '',
    };

    // Se esiste già un doc dello stesso tipo → aggiorna
    const existing = await DocumentoAdmin.findOne({ amministratoreId: req.params.id, tipo });
    let doc;
    if (existing) {
      doc = await DocumentoAdmin.findByIdAndUpdate(existing._id, fileData, { new: true }).select('-fileContent');
    } else {
      const created = await DocumentoAdmin.create({ amministratoreId: req.params.id, tipo, ...fileData });
      doc = { ...created.toObject(), fileContent: undefined };
    }
    res.status(201).json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve il file documento admin
router.get('/admin/:id/documento/:tipo/file', async (req, res) => {
  try {
    const doc = await DocumentoAdmin.findOne({ amministratoreId: req.params.id, tipo: req.params.tipo });
    if (!doc || !doc.fileContent) return res.status(404).json({ error: 'Documento non trovato' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    res.send(Buffer.from(doc.fileContent, 'base64'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// WALLET ADMIN (dal backoffice)
// ═══════════════════════════════════════════════════════════
router.get('/admin/:id/wallet', async (req, res) => {
  try {
    const utente = await Utente.findById(req.params.id).select('saldo').lean();
    if (!utente) return res.status(404).json({ error: 'Admin non trovato' });
    const movimenti = await Movimento.find({ utenteId: req.params.id }).sort({ createdAt: -1 }).lean();
    const richiesteWallet = await RichiestaWallet.find({ utenteId: req.params.id }).sort({ createdAt: -1 }).select('-ricevutaContent').lean();
    res.json({ saldo: utente.saldo || 0, movimenti, richiesteWallet });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Azzera il wallet dell'admin
router.post('/admin/:id/wallet/azzera', async (req, res) => {
  try {
    const utente = await Utente.findById(req.params.id);
    if (!utente) return res.status(404).json({ error: 'Admin non trovato' });
    const saldoPrecedente = utente.saldo || 0;
    if (saldoPrecedente > 0) {
      await Movimento.create({ utenteId: utente._id, tipo: 'out', importo: saldoPrecedente, desc: 'Azzeramento wallet (backoffice)' });
    }
    await Utente.findByIdAndUpdate(utente._id, { saldo: 0 });
    await RichiestaWallet.updateMany({ utenteId: utente._id, stato: 'in_attesa' }, { stato: 'pagata' });
    res.json({ ok: true, saldoAzzerato: saldoPrecedente });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Paga una richiesta wallet (con ricevuta PDF)
router.post('/admin/:id/wallet/paga', upload.single('ricevuta'), async (req, res) => {
  try {
    const { richiestaId } = req.body;
    if (!richiestaId) return res.status(400).json({ error: 'richiestaId obbligatorio' });
    const richiesta = await RichiestaWallet.findById(richiestaId);
    if (!richiesta) return res.status(404).json({ error: 'Richiesta non trovata' });
    if (richiesta.utenteId.toString() !== req.params.id) return res.status(400).json({ error: 'Richiesta non appartiene a questo admin' });
    if (richiesta.stato === 'pagata') return res.status(400).json({ error: 'Richiesta già pagata' });

    const updateData = { stato: 'pagata' };
    if (req.file) {
      updateData.ricevutaContent = req.file.buffer.toString('base64');
      updateData.ricevutaName = req.file.originalname;
    }
    await RichiestaWallet.findByIdAndUpdate(richiestaId, updateData);

    await Utente.findByIdAndUpdate(req.params.id, { $inc: { saldo: -richiesta.importo } });
    await Movimento.create({ utenteId: req.params.id, tipo: 'out', importo: richiesta.importo, desc: 'Pagamento wallet' });

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve ricevuta PDF (backoffice)
router.get('/richieste-wallet/:id/ricevuta', async (req, res) => {
  try {
    const r = await RichiestaWallet.findById(req.params.id);
    if (!r || !r.ricevutaContent) return res.status(404).json({ error: 'Ricevuta non trovata' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${r.ricevutaName || 'ricevuta.pdf'}"`);
    res.send(Buffer.from(r.ricevutaContent, 'base64'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Tutte le richieste wallet (per dashboard backoffice)
router.get('/richieste-wallet', async (req, res) => {
  try {
    const richieste = await RichiestaWallet.find({})
      .populate('utenteId', 'nome cognome email saldo')
      .sort({ createdAt: -1 }).select('-ricevutaContent').lean();
    res.json(richieste);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// CONTRATTI — lista + creazione + serve PDF
// ═══════════════════════════════════════════════════════════
router.get('/contratti', async (req, res) => {
  try {
    const filter = {};
    if (req.query.adminId) filter.amministratoreId = req.query.adminId;
    const contratti = await Contratto.find(filter)
      .populate('amministratoreId', 'nome cognome studio email')
      .populate('condominioId', 'nome via citta')
      .sort({ createdAt: -1 })
      .select('-pdfContent -pods.pdfContent')
      .lean();
    // Segnala se il PDF esiste senza inviare i dati
    res.json(contratti.map(c => ({ ...c, hasPdf: !!(c.pdfName), pods: (c.pods || []).map(p => ({ ...p, hasPdf: !!(p.pdfName) })) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Creazione contratto (con commissione diretta €, PDF base64, multi-POD)
router.post('/contratti', upload.any(), async (req, res) => {
  try {
    const {
      amministratoreId, condominioId, servizioId, fornitore,
      prezzo, commissioneCondovia, stornoTipo, stornoValore,
      dataInizio, dataScadenza, richiestaId, pods: podsJson,
    } = req.body;

    if (!amministratoreId || !condominioId || !servizioId || !fornitore || !prezzo || !dataInizio || !dataScadenza) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    const prezzoNum = parseFloat(prezzo);
    const commNum = parseFloat(commissioneCondovia) || 0;
    const stornoVal = parseFloat(stornoValore) || 0;
    // Storno calcolato sulla commissione Condovia (non sul prezzo fornitore)
    const stornoAmm = stornoTipo === 'pct' ? (commNum * stornoVal / 100) : stornoVal;
    const margine = commNum - stornoAmm;

    // PDF principale
    const mainPdf = (req.files || []).find(f => f.fieldname === 'pdf');

    // Multi-POD
    let pods = [];
    if (podsJson) {
      try {
        const podsData = JSON.parse(podsJson);
        pods = podsData.map((p, idx) => {
          const podFile = (req.files || []).find(f => f.fieldname === `pod_pdf_${idx}`);
          return {
            podNumber: p.podNumber || '',
            pdfContent: podFile ? podFile.buffer.toString('base64') : '',
            pdfName: podFile ? podFile.originalname : '',
          };
        });
      } catch { pods = []; }
    }

    const contratto = await Contratto.create({
      amministratoreId, condominioId, servizioId, fornitore,
      prezzo: prezzoNum,
      commissioneCondovia: commNum,
      stornoTipo: stornoTipo || 'fix',
      stornoValore: stornoVal,
      stornoAmmontare: parseFloat(stornoAmm.toFixed(2)),
      margineCondovia: parseFloat(margine.toFixed(2)),
      dataInizio: new Date(dataInizio),
      dataScadenza: new Date(dataScadenza),
      stato: 'attivo',
      pdfContent: mainPdf ? mainPdf.buffer.toString('base64') : '',
      pdfName: mainPdf ? mainPdf.originalname : '',
      pods,
      richiestaId: richiestaId || undefined,
    });

    // Accredita storno wallet admin
    if (stornoAmm > 0) {
      const serv = await Servizio.findOne({ sid: servizioId });
      await Movimento.create({
        utenteId: amministratoreId, tipo: 'in',
        importo: parseFloat(stornoAmm.toFixed(2)),
        desc: `Storno ${serv ? serv.label : servizioId}`,
        contrattoId: contratto._id,
      });
      await Utente.findByIdAndUpdate(amministratoreId, { $inc: { saldo: parseFloat(stornoAmm.toFixed(2)) } });
    }

    if (richiestaId) {
      await Richiesta.findByIdAndUpdate(richiestaId, { stato: 'contratto_caricato' });
    }

    res.status(201).json({ _id: contratto._id, hasPdf: !!mainPdf });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve PDF contratto principale
router.get('/contratti/:id/pdf', async (req, res) => {
  try {
    const c = await Contratto.findById(req.params.id).select('pdfContent pdfName');
    if (!c || !c.pdfContent) return res.status(404).json({ error: 'PDF non trovato' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${c.pdfName || 'contratto.pdf'}"`);
    res.send(Buffer.from(c.pdfContent, 'base64'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve PDF POD singolo
router.get('/contratti/:id/pod/:idx/pdf', async (req, res) => {
  try {
    const c = await Contratto.findById(req.params.id).select('pods');
    const pod = c?.pods?.[parseInt(req.params.idx)];
    if (!pod || !pod.pdfContent) return res.status(404).json({ error: 'PDF non trovato' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pod.pdfName || 'pod.pdf'}"`);
    res.send(Buffer.from(pod.pdfContent, 'base64'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// RICHIESTE — gestione dal backoffice
// ═══════════════════════════════════════════════════════════
router.get('/richieste', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.stato) filtro.stato = req.query.stato;
    if (req.query.adminId) filtro.amministratoreId = req.query.adminId;
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
// MARGINI
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
          totaleCommissione: { $sum: '$commissioneCondovia' },
          totaleStorno: { $sum: '$stornoAmmontare' },
          totaleMargine: { $sum: '$margineCondovia' },
        },
      },
      { $sort: { totaleMargine: -1 } },
    ]);
    const totali = margini.reduce((acc, m) => ({
      prezzo: acc.prezzo + m.totalePrezzo,
      commissione: acc.commissione + (m.totaleCommissione || 0),
      storno: acc.storno + m.totaleStorno,
      margine: acc.margine + m.totaleMargine,
      contratti: acc.contratti + m.numContratti,
    }), { prezzo: 0, commissione: 0, storno: 0, margine: 0, contratti: 0 });
    res.json({ margini, totali });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// ISCRIZIONI
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
// SEED-RESET (solo sviluppo)
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
    await RichiestaWallet.deleteMany({});
    await DocumentoAdmin.deleteMany({});
    await Utente.deleteMany({ ruolo: { $ne: 'commerciale' } });
    res.json({ ok: true, message: 'Dati resettati (servizi e commerciale preservati)' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
