const TotalMensagens = require('../models/TotalMensagens');
const { log } = require('../util/logger');

function incremento(tipo, id, plataforma) {
  return {
    updateOne: {
      filter: { tipo, id: String(id), plataforma },
      update: { $inc: { mensagens: 1 } },
      upsert: true
    }
  };
}

async function registrarMensagem({ autorId, guildId, plataforma = 'fluxer' }) {
  try {
    await TotalMensagens.bulkWrite(
      [incremento('usuario', autorId, plataforma), incremento('servidor', guildId, plataforma)],
      { ordered: false }
    );
  } catch (e) {
    log.error('DB', 'Erro ao atualizar totais de mensagens', e);
  }
}

module.exports = { registrarMensagem };
