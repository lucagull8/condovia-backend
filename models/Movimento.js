const mongoose = require('mongoose');

const movimentoSchema = new mongoose.Schema({
  utenteId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Utente', required: true },
  tipo:        { type: String, enum: ['in', 'out'], required: true },
  importo:     { type: Number, required: true },
  desc:        { type: String, default: '' },
  contrattoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contratto' },
}, { timestamps: true });

module.exports = mongoose.model('Movimento', movimentoSchema);
