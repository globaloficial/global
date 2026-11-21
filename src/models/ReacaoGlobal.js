const { Schema, model } = require('mongoose');

const reacaoGlobalSchema = new Schema({
  grupoId: { type: String, required: true },
  usuarioId: { type: String, required: true },
  plataforma: { type: String, default: 'fluxer' },
  emoji: { type: String, required: true },
  criadoEm: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }
});

reacaoGlobalSchema.index({ grupoId: 1, usuarioId: 1, emoji: 1 }, { unique: true });

module.exports = model('ReacaoGlobal', reacaoGlobalSchema);
