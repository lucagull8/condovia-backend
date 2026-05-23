const mongoose = require('mongoose');

const richiestaSchema = new mongoose.Schema({
  amministratoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utente', required: true },
  condominioId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Condominio' },
  servizioId:       { type: String, required: true },
  note:             { type: String, default: '' },
  notaInterna:      { type: String, default: '' },
  stato:            { type: String, enum: ['in_attesa', 'contattato', 'contratto_caricato', 'chiusa'], default: 'in_attesa' },
}, { timestamps: true });

module.exports = mongoose.model('Richiesta', richiestaSchema);
