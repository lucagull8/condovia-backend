const jwt = require('jsonwebtoken');
const Utente = require('../models/Utente');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Token mancante' });
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const utente = await Utente.findById(decoded.id).select('-password');
    if (!utente) return res.status(401).json({ error: 'Utente non trovato' });
    req.utente = utente;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token non valido' });
  }
}

function requireCommerciale(req, res, next) {
  if (req.utente.ruolo !== 'commerciale') return res.status(403).json({ error: 'Accesso riservato al team commerciale' });
  next();
}

function requireAdmin(req, res, next) {
  if (req.utente.ruolo !== 'amministratore') return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  next();
}

module.exports = { requireAuth, requireCommerciale, requireAdmin };
