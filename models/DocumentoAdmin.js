const mongoose = require('mongoose');

const documentoAdminSchema = new mongoose.Schema({
  amministratoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utente', required: true },
  tipo:             { type: String, enum: ['nomina', 'bolletta'], required: true },
  fileName:         { type: String, required: true },
  fileContent:      { type: String, required: true }, // base64
  note:             { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('DocumentoAdmin', documentoAdminSchema);
