const mongoose = require('mongoose');

const condominioSchema = new mongoose.Schema({
  nome:              { type: String, required: true, trim: true },
  via:               { type: String, default: '' },
  citta:             { type: String, default: '' },
  unita:             { type: Number, default: 0 },
  amministratoreId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Utente', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Condominio', condominioSchema);
