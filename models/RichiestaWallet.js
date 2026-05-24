const mongoose = require('mongoose');

const richiestaWalletSchema = new mongoose.Schema({
  utenteId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Utente', required: true },
  importo:         { type: Number, required: true },
  stato:           { type: String, enum: ['in_attesa', 'pagata'], default: 'in_attesa' },
  ricevutaContent: { type: String, default: '' }, // base64 PDF
  ricevutaName:    { type: String, default: '' },
  note:            { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('RichiestaWallet', richiestaWalletSchema);
