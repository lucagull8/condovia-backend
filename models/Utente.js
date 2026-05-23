const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const utenteSchema = new mongoose.Schema({
  nome:       { type: String, required: true, trim: true },
  cognome:    { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  ruolo:      { type: String, enum: ['amministratore', 'commerciale'], default: 'amministratore' },
  stato:      { type: String, enum: ['pending', 'attivo', 'rifiutato', 'sospeso'], default: 'pending' },
  studio:     { type: String, default: '' },
  telefono:   { type: String, default: '' },
  pec:        { type: String, default: '' },
  partitaIva: { type: String, default: '' },
  dataNascita:{ type: Date },
  saldo:      { type: Number, default: 0 },
}, { timestamps: true });

utenteSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

utenteSchema.methods.confrontaPassword = function (pw) {
  return bcrypt.compare(pw, this.password);
};

module.exports = mongoose.model('Utente', utenteSchema);
