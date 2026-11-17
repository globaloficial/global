const { Schema, model } = require('mongoose');

const RETENCAO_SEGUNDOS = 90 * 24 * 60 * 60;

const alteracaoSchema = new Schema({
  guildId: { type: String, required: true },
  plataforma: { type: String, default: null },
  userId: { type: String, required: true },
  userNome: { type: String, required: true },
  userPlataforma: { type: String, default: null },
  campo: { type: String, required: true },
  de: { type: Schema.Types.Mixed, default: null },
  para: { type: Schema.Types.Mixed, default: null },
  criadoEm: { type: Date, default: () => new Date(), expires: RETENCAO_SEGUNDOS }
});

alteracaoSchema.index({ guildId: 1, criadoEm: -1 });

module.exports = model('AlteracaoPainel', alteracaoSchema);
