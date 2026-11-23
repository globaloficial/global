const { Schema, model } = require('mongoose');

const totalMensagensSchema = new Schema({
  tipo: { type: String, enum: ['usuario', 'servidor'], required: true },
  id: { type: String, required: true },
  plataforma: { type: String, default: 'fluxer' },
  mensagens: { type: Number, default: 0 }
});

totalMensagensSchema.index({ tipo: 1, id: 1, plataforma: 1 }, { unique: true });
totalMensagensSchema.index({ tipo: 1, mensagens: -1 });

module.exports = model('TotalMensagens', totalMensagensSchema);
