const { Schema, model } = require('mongoose');

const painelSchema = new Schema({
  messageId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  tipo: { type: String, enum: ['config', 'automod'], required: true },
  criadoEm: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }
});

module.exports = model('Painel', painelSchema);
