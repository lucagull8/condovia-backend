const mongoose = require('mongoose');

const fatturazioneSchema = new mongoose.Schema({
  numero:           { type: String, required: true, unique: true },
  amministratoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utente', required: true },
  condominioId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Condominio' },
  tipo:             { type: String, required: true, trim: true },
  importo:          { type: Number, required: true, min: 0 },
  stato:            { type: String, enum: ['in_attesa', 'elaborazione', 'pagata'], default: 'in_attesa' },
  note:             { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Fatturazione', fatturazioneSchema);
