const router = require('express').Router();
const jwt = require('jsonwebtoken');
const Utente = require('../models/Utente');
const { requireAuth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e password richiesti' });
    const utente = await Utente.findOne({ email: email.toLowerCase().trim() });
    if (!utente) return res.status(401).json({ error: 'Credenziali non valide' });
    if (utente.stato !== 'attivo') return res.status(403).json({ error: 'Account non ancora attivo. Contatta il team Condovia.' });
    const ok = await utente.confrontaPassword(password);
    if (!ok) return res.status(401).json({ error: 'Credenziali non valide' });
    const token = jwt.sign({ id: utente._id, ruolo: utente.ruolo }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safe } = utente.toObject();
    res.json({ token, utente: safe, ruolo: utente.ruolo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nome, cognome, email, password, dataNascita, studio, telefono } = req.body;
    if (!nome || !cognome || !email || !password) return res.status(400).json({ error: 'Nome, cognome, email e password richiesti' });
    if (password.length < 6) return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
    const exists = await Utente.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'Email già registrata' });
    await Utente.create({
      nome: nome.trim(), cognome: cognome.trim(),
      email: email.toLowerCase().trim(),
      password,
      ruolo: 'amministratore', stato: 'pending',
      dataNascita: dataNascita || undefined,
      studio: studio || '', telefono: telefono || '',
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json(req.utente);
});

module.exports = router;
