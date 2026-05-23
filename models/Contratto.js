const mongoose = require('mongoose');

const contrattoSchema = new mongoose.Schema({
  amministratoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utente', required: true },
  condominioId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Condominio', required: true },
  servizioId:       { type: String, required: true },
  fornitore:        { type: String, required: true, trim: true },
  prezzo:           { type: Number, required: true },
  stornoTipo:       { type: String, enum: ['fix', 'pct'], default: 'fix' },
  stornoValore:     { type: Number, default: 0 },
  stornoAmmontare:  { type: Number, default: 0 },
  margineCondovia:  { type: Number, default: 0 },
  dataInizio:       { type: Date, required: true },
  dataScadenza:     { type: Date, required: true },
  stato:            { type: String, enum: ['attivo', 'scadenza', 'scaduto'], default: 'attivo' },
  pdfUrl:           { type: String, default: '' },
  richiestaId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Richiesta' },
}, { timestamps: true });

module.exports = mongoose.model('Contratto', contrattoSchema);
