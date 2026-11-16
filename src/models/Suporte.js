const { Schema, model } = require('mongoose');

const mensagemSchema = new Schema({
  autorId: { type: String, required: true },
  autorNome: { type: String, required: true },
  autorAvatar: { type: String, default: null },
  equipe: { type: Boolean, default: false },
  texto: { type: String, required: true },
  em: { type: Number, default: () => Date.now() }
}, { _id: false });

const suporteSchema = new Schema({
  numero: { type: Number, required: true, unique: true },
  plataforma: { type: String, enum: ['fluxer', 'discord'], required: true },
  autorId: { type: String, required: true, index: true },
  autorNome: { type: String, required: true },
  autorAvatar: { type: String, default: null },
  assunto: { type: String, required: true },
  status: { type: String, enum: ['aberta', 'andamento', 'resolvida'], default: 'aberta', index: true },
  mensagens: { type: [mensagemSchema], default: [] },
  criadoEm: { type: Number, default: () => Date.now() },
  atualizadoEm: { type: Number, default: () => Date.now() }
});

module.exports = model('Suporte', suporteSchema);
