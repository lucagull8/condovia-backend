const mongoose = require('mongoose');

const podSchema = new mongoose.Schema({
  podNumber:  { type: String, default: '' },
  pdfContent: { type: String, default: '' }, // base64
  pdfName:    { type: String, default: '' },
}, { _id: false });

const contrattoSchema = new mongoose.Schema({
  amministratoreId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Utente', required: true },
  condominioId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Condominio', required: true },
  servizioId:          { type: String, required: true },
  fornitore:           { type: String, required: true, trim: true },
  prezzo:              { type: Number, required: true }, // prezzo annuo fornitore
  commissioneCondovia: { type: Number, default: 0 },    // € commissione diretta inserita dal backoffice
  stornoTipo:          { type: String, enum: ['fix', 'pct'], default: 'fix' },
  stornoValore:        { type: Number, default: 0 },
  stornoAmmontare:     { type: Number, default: 0 },    // € storno calcolato
  margineCondovia:     { type: Number, default: 0 },    // commissioneCondovia - stornoAmmontare
  dataInizio:          { type: Date, required: true },
  dataScadenza:        { type: Date, required: true },
  stato:               { type: String, enum: ['attivo', 'scadenza', 'scaduto'], default: 'attivo' },
  // File storage base64 (evita problemi filesystem su Render)
  pdfContent:          { type: String, default: '' },
  pdfName:             { type: String, default: '' },
  // Multi-POD per energia
  pods:                [podSchema],
  richiestaId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Richiesta' },
}, { timestamps: true });

module.exports = mongoose.model('Contratto', contrattoSchema);
