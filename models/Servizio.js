const mongoose = require('mongoose');

const servizioSchema = new mongoose.Schema({
  sid:    { type: String, required: true, unique: true },
  label:  { type: String, required: true },
  titolo: { type: String, default: '' },
  desc:   { type: String, default: '' },
  color:  { type: String, default: '#999' },
  bg:     { type: String, default: '#f5f5f5' },
  icon:   { type: String, default: 'Shield' },
  commissionePct: { type: Number, default: 0.15 },
  commissioneNote: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Servizio', servizioSchema);
