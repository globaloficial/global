const MensagemGlobal = require('../src/models/MensagemGlobal');
const TotalMensagens = require('../src/models/TotalMensagens');
const { SOMENTE_ORIGEM } = require('../src/services/perfilDados');

async function agrupar(campo) {
  return MensagemGlobal.aggregate([
    { $match: SOMENTE_ORIGEM },
    { $group: { _id: { id: `$${campo}`, plataforma: '$plataforma' }, mensagens: { $sum: 1 } } }
  ]);
}

async function gravar(tipo, grupos) {
  if (grupos.length === 0) return;

  await TotalMensagens.bulkWrite(
    grupos.map(({ _id, mensagens }) => ({
      updateOne: {
        filter: { tipo, id: String(_id.id), plataforma: _id.plataforma || 'fluxer' },
        update: { $inc: { mensagens } },
        upsert: true
      }
    })),
    { ordered: false }
  );
}

async function executar() {
  await gravar('usuario', await agrupar('autorId'));
  await gravar('servidor', await agrupar('guildId'));
}

module.exports = { executar };
