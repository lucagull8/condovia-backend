require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];
const PROD_ORIGINS = ['https://condovia.it', 'https://www.condovia.it'];
if (process.env.FRONTEND_URL && !PROD_ORIGINS.includes(process.env.FRONTEND_URL)) {
  PROD_ORIGINS.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / Postman / server-to-server
    const allowed = [...DEV_ORIGINS, ...PROD_ORIGINS];
    cb(allowed.includes(origin) ? null : new Error('CORS non consentito'), allowed.includes(origin));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/servizi',    require('./routes/servizi'));
app.use('/api/condomini',  require('./routes/condomini'));
app.use('/api/wallet',     require('./routes/wallet'));
app.use('/api/richieste',  require('./routes/richieste'));
app.use('/api/backoffice', require('./routes/backoffice'));

app.use((req, res) => res.status(404).json({ error: 'Endpoint non trovato' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Errore interno' });
});

// ─── AutoSeed ────────────────────────────────────────────────────────────────
const SERVIZI_REALI = [
  { sid: 'luce-gas',        label: 'Luce e Gas',                     icon: 'Zap',          color: '#f5a623', bg: '#fef3e2', desc: 'Fornitura di energia elettrica e gas metano per le parti comuni del condominio con tariffe agevolate.' },
  { sid: 'contabilita',     label: 'Contabilità',                    icon: 'Calculator',   color: '#7c3aed', bg: '#ede9fe', desc: 'Gestione completa della contabilità condominiale: bilancio preventivo, consuntivo e rendiconto annuale.' },
  { sid: 'manutenzioni',    label: 'Manutenzioni',                   icon: 'Wrench',       color: '#0ea5e9', bg: '#e0f2fe', desc: 'Interventi di manutenzione ordinaria e straordinaria su tutte le parti comuni del condominio.' },
  { sid: 'disinfestazione', label: 'Disinfestazioni e Derattizzazione', icon: 'Bug',        color: '#22c55e', bg: '#dcfce7', desc: 'Servizi professionali di disinfestazione, derattizzazione e sanificazione degli spazi condominiali.' },
  { sid: 'verde',           label: 'Manutenzione Verde',             icon: 'Leaf',         color: '#16a34a', bg: '#f0fdf4', desc: 'Cura e manutenzione periodica di giardini, siepi, alberi e aree verdi condominiali.' },
  { sid: 'caldaie',         label: 'Manutenzione Caldaie',           icon: 'Thermometer',  color: '#f59e0b', bg: '#fef3c7', desc: 'Manutenzione, revisione e certificazione delle caldaie e degli impianti termici condominiali.' },
  { sid: 'ascensori',       label: 'Ascensori',                      icon: 'ArrowUpDown',  color: '#92400e', bg: '#fef3c7', desc: 'Manutenzione ordinaria e straordinaria degli impianti elevatori con verifica ISPESL e pronto intervento h24.' },
];

async function autoSeed() {
  const Utente   = require('./models/Utente');
  const Servizio = require('./models/Servizio');

  // 1. Servizi reali — sempre sostituiti con i 7 ufficiali
  await Servizio.deleteMany({});
  await Servizio.insertMany(SERVIZI_REALI);
  console.log(`✅ AutoSeed: ${SERVIZI_REALI.length} servizi aggiornati`);

  // 2. Rimuovi iscrizioni pending e vecchi utenti commerciale non in lista
  const BACKOFFICE_EMAILS = ['lgullotto@condovia.it', 'asaraceno@condovia.it', 'ademichele@condovia.it'];
  await Utente.deleteMany({ stato: 'pending' });
  await Utente.deleteMany({ ruolo: 'commerciale', email: { $nin: BACKOFFICE_EMAILS } });
  console.log('✅ AutoSeed: vecchie registrazioni e utenti backoffice rimossi');

  // 3. Crea i 3 utenti backoffice se non esistono
  const BACKOFFICE_USERS = [
    { nome: 'Luca',   cognome: 'Gullotto',    email: 'lgullotto@condovia.it' },
    { nome: 'Alessio',cognome: 'Saraceno',    email: 'asaraceno@condovia.it' },
    { nome: 'Andrea', cognome: 'De Michele',  email: 'ademichele@condovia.it' },
  ];
  for (const u of BACKOFFICE_USERS) {
    const exists = await Utente.findOne({ email: u.email });
    if (!exists) {
      await Utente.create({ ...u, password: 'Admin1234', ruolo: 'commerciale', stato: 'attivo', studio: 'Condovia S.r.l.' });
      console.log(`✅ AutoSeed: utente backoffice creato — ${u.email}`);
    }
  }

  console.log('🎉 AutoSeed completato');
}

// ─── Start ───────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('✅ MongoDB connesso');

  // Indice email (idempotente)
  await mongoose.connection.db.collection('utentes').createIndex({ email: 1 }, { unique: true }).catch(() => {});

  await autoSeed();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Condovia backend su porta ${PORT}`));
}).catch(err => {
  console.error('❌ MongoDB:', err.message);
  process.exit(1);
});
