#!/usr/bin/env node
/**
 * Condovia — Seed Script
 * 
 * USO:
 *   node scripts/seed.js                 → inserisce servizi + demo (se non esistono)
 *   node scripts/seed.js --reset         → CANCELLA tutto e reinserisce servizi + demo
 *   node scripts/seed.js --reset --clean → CANCELLA tutto, inserisce SOLO i 17 servizi + utente commerciale di sistema
 *   npm run seed:demo                    → alias per primo
 *   npm run seed:reset                   → alias per secondo
 *   npm run seed:clean                   → alias per terzo (produzione pulita)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Utente     = require('../models/Utente');
const Servizio   = require('../models/Servizio');
const Condominio = require('../models/Condominio');
const Contratto  = require('../models/Contratto');
const Richiesta  = require('../models/Richiesta');
const Movimento  = require('../models/Movimento');
const Fatturazione = require('../models/Fatturazione');

// ═══════════════════════════════════════════════════════════
// CATALOGO SERVIZI — strutturale, inserito SEMPRE
// ═══════════════════════════════════════════════════════════
const SERVIZI = [
  { sid: 'energia', label: 'Energia', titolo: 'Energia Elettrica', desc: 'Fornitura di energia elettrica per le parti comuni del condominio.', color: '#f5a623', bg: '#fef3e2', icon: 'Zap', commissionePct: 0.15, commissioneNote: '~300€/POD da tabella massima' },
  { sid: 'gas', label: 'Gas', titolo: 'Gas Metano', desc: 'Fornitura di gas metano per la centrale termica condominiale.', color: '#e8740c', bg: '#fde8d0', icon: 'Flame', commissionePct: 0.12, commissioneNote: '0,12-0,14 €/mtc da tabella massima' },
  { sid: 'acque', label: 'Acque potabili', titolo: 'Acque Potabili', desc: 'Gestione e certificazione della qualità delle acque potabili ai sensi del D.Lgs. 31/2001.', color: '#3b82f6', bg: '#dbeafe', icon: 'Droplets', commissionePct: 0.20 },
  { sid: 'verde', label: 'Aree verdi', titolo: 'Aree Verdi', desc: 'Manutenzione periodica di giardini, siepi e aree verdi condominiali.', color: '#22c55e', bg: '#dcfce7', icon: 'Leaf', commissionePct: 0.15 },
  { sid: 'pulizie', label: 'Pulizie scale', titolo: 'Pulizie Scale', desc: 'Servizio di pulizia professionale delle scale e delle parti comuni.', color: '#8b5cf6', bg: '#ede9fe', icon: 'Sparkles', commissionePct: 0.15 },
  { sid: 'ascensore', label: 'Ascensore', titolo: 'Manutenzione Ascensore', desc: 'Manutenzione ordinaria e straordinaria degli impianti elevatori.', color: '#92400e', bg: '#fef3c7', icon: 'ArrowUpDown', commissionePct: 0.20 },
  { sid: 'cancelli', label: 'Cancelli', titolo: 'Cancelli Automatici', desc: 'Manutenzione e assistenza h24 dei cancelli automatici.', color: '#ef4444', bg: '#fee2e2', icon: 'DoorOpen', commissionePct: 0.20 },
  { sid: 'antincendio', label: 'Antincendio', titolo: 'Prevenzione Incendi', desc: 'Gestione impianti antincendio, estintori e certificazioni.', color: '#dc2626', bg: '#fde8d0', icon: 'Flame', commissionePct: 0.20 },
  { sid: 'privacy', label: 'Privacy', titolo: 'Privacy & GDPR', desc: 'Consulenza e gestione degli adempimenti in materia di protezione dei dati personali (GDPR).', color: '#64748b', bg: '#f1f5f9', icon: 'Shield', commissionePct: 0.20 },
  { sid: 'termiche', label: 'Centrali termiche', titolo: 'Centrali Termiche', desc: 'Manutenzione e gestione delle centrali termiche condominiali.', color: '#f59e0b', bg: '#fef3c7', icon: 'Thermometer', commissionePct: 0.22, commissioneNote: '20-25% manutenzione + 20% certificazione' },
  { sid: 'idraulica', label: 'Idraulica', titolo: 'Idraulica', desc: 'Gestione degli impianti idraulici condominiali e pronto intervento.', color: '#0ea5e9', bg: '#e0f2fe', icon: 'Wrench', commissionePct: 0.15 },
  { sid: 'elettrici', label: 'Impianti elettrici', titolo: 'Impianti Elettrici', desc: 'Manutenzione e messa a norma degli impianti elettrici delle parti comuni.', color: '#eab308', bg: '#fefce8', icon: 'Bolt', commissionePct: 0.15 },
  { sid: 'ras', label: 'RAS Condominio', titolo: 'RAS Condominio', desc: 'Registro Anagrafe Sicurezza e adempimenti di legge sulla sicurezza condominiale.', color: '#4ade80', bg: '#f0fdf4', icon: 'ClipboardList', commissionePct: 0.20, commissioneNote: '~150€ fisso' },
  { sid: 'assicurazione', label: 'Assicurazione', titolo: 'Assicurazione Globale Fabbricato', desc: 'Polizza globale fabbricato: incendio, RC verso terzi, eventi atmosferici.', color: '#1e3a5f', bg: '#dde7ee', icon: 'ShieldCheck', commissionePct: 0.15, commissioneNote: '14-15%' },
  { sid: 'edilizia', label: 'Edilizia minore', titolo: 'Edilizia Minore', desc: 'Interventi di manutenzione edilizia ordinaria su parti comuni.', color: '#b87333', bg: '#fbf3ea', icon: 'HardHat', commissionePct: 0.15 },
  { sid: 'videosorveglianza', label: 'Videosorveglianza', titolo: 'Videosorveglianza', desc: 'Installazione e gestione sistemi di videosorveglianza per aree comuni.', color: '#6b7280', bg: '#f3f4f6', icon: 'Camera', commissionePct: 0.18 },
  { sid: 'contabilita', label: 'Contabilità', titolo: 'Contabilità Condominiale', desc: 'Gestione completa della contabilità condominiale: bilancio, consuntivo e rendiconto.', color: '#7c3aed', bg: '#ede9fe', icon: 'Calculator', commissionePct: 0.12 },
];

// ═══════════════════════════════════════════════════════════
// FLAGS
// ═══════════════════════════════════════════════════════════
const args = process.argv.slice(2);
const doReset = args.includes('--reset');
const doClean = args.includes('--clean');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connesso');

  // ─── RESET: svuota tutte le collezioni ───────────────────
  if (doReset) {
    console.log('🗑️  Reset in corso — svuoto tutte le collezioni…');
    await Utente.deleteMany({});
    await Servizio.deleteMany({});
    await Condominio.deleteMany({});
    await Contratto.deleteMany({});
    await Richiesta.deleteMany({});
    await Movimento.deleteMany({});
    await Fatturazione.deleteMany({});
    console.log('✅ Tutte le collezioni svuotate');
  }

  // ─── SERVIZI: inseriti SEMPRE (catalogo strutturale) ─────
  const serviziEsistenti = await Servizio.countDocuments({});
  if (serviziEsistenti === 0) {
    for (const s of SERVIZI) await Servizio.create(s);
    console.log(`✅ ${SERVIZI.length} servizi catalogo inseriti`);
  } else {
    console.log(`ℹ️  Servizi già presenti (${serviziEsistenti}), skip`);
  }

  // ─── UTENTE COMMERCIALE: inserito SEMPRE ─────────────────
  let comm = await Utente.findOne({ email: 'commerciale@condovia.it' });
  if (!comm) {
    comm = await Utente.create({
      nome: doClean ? 'Staff' : 'Marta',
      cognome: doClean ? 'Condovia' : 'Russo',
      email: 'commerciale@condovia.it',
      password: 'admin123',
      ruolo: 'commerciale',
      stato: 'attivo',
      studio: 'Condovia S.r.l.',
    });
    console.log(`✅ Utente commerciale creato: ${comm.nome} ${comm.cognome}`);
  } else {
    console.log('ℹ️  Utente commerciale già presente, skip');
  }

  // ─── MODALITÀ CLEAN: termina qui ────────────────────────
  if (doClean) {
    console.log('');
    console.log('══════════════════════════════════════════════');
    console.log('✅ SEED CLEAN completato');
    console.log('   • 17 servizi catalogo ✓');
    console.log('   • Utente commerciale di sistema ✓');
    console.log('   • Nessun dato demo inserito');
    console.log('   • Database pronto per la produzione');
    console.log('══════════════════════════════════════════════');
    await mongoose.disconnect();
    process.exit(0);
  }

  // ═══════════════════════════════════════════════════════════
  // MODALITÀ DEMO: inserisce anche admin Alessio + condomini
  // ═══════════════════════════════════════════════════════════

  // Utente admin demo
  let alessio = await Utente.findOne({ email: 'alessio.saraceno@condovia.it' });
  if (!alessio) {
    alessio = await Utente.create({
      nome: 'Alessio', cognome: 'Saraceno',
      email: 'alessio.saraceno@condovia.it', password: 'demo123',
      ruolo: 'amministratore', stato: 'attivo',
      studio: 'Studio Saraceno Roma', telefono: '+39 06 8821 4456',
      pec: 'a.saraceno@pec.condovia.it', partitaIva: 'IT12345678901',
    });
    console.log('✅ Utente admin demo creato (Alessio Saraceno)');
  }

  // 6 condomini demo
  const condoEsistenti = await Condominio.countDocuments({});
  if (condoEsistenti === 0) {
    const condos = [
      { nome: 'Residence Aventino', via: 'Via di San Saba 24', citta: 'Roma', unita: 32 },
      { nome: 'Palazzo Mazzini', via: 'Viale Mazzini 88', citta: 'Roma', unita: 24 },
      { nome: 'Trionfale', via: 'Via Trionfale 145', citta: 'Roma', unita: 48 },
      { nome: 'Villa dei Pini', via: 'Via Tuscolana 412', citta: 'Frascati', unita: 16 },
      { nome: 'Borgo Pio', via: 'Via di Borgo Pio 12', citta: 'Roma', unita: 8 },
      { nome: 'Casa di Marina', via: 'Lungomare 22', citta: 'Anzio', unita: 20 },
    ];
    for (const c of condos) await Condominio.create({ ...c, amministratoreId: alessio._id });
    console.log('✅ 6 condomini demo creati per Alessio');
  }

  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log('✅ SEED DEMO completato');
  console.log('══════════════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Errore seed:', err.message);
  process.exit(1);
});
