const Guild = require('../models/Guild');
const { idDoServidor } = require('../util/ids');
const { pontePorCanal, participanteDoCanal, definirPausaDoParticipante, removerParticipante } = require('./pontes');
const { limparFalhasDestino } = require('./destinos');

async function conexaoDoCanal(message) {
  const guildId = idDoServidor(message);
  if (!guildId) return null;
  const gId = String(guildId);
  const canalId = String(message.channel.id);

  const global = await Guild.findOne({ guildId: gId, canalId }).lean();
  if (global) {
    return { tipo: 'global', nome: 'Conexão Global', guildId: gId, canalId, pausado: !!global.pausado };
  }

  const ponte = await pontePorCanal(canalId);
  const participante = ponte && participanteDoCanal(ponte, canalId);
  if (participante && participante.guildId === gId) {
    return { tipo: 'ponte', nome: 'Conexão Privada', guildId: gId, canalId, ponte, pausado: !!participante.pausado };
  }

  return null;
}

async function definirPausa(conexao, pausado) {
  if (conexao.tipo === 'global') {
    await Guild.updateOne({ guildId: conexao.guildId, canalId: conexao.canalId }, { pausado });
    return;
  }
  await definirPausaDoParticipante(conexao.ponte.codigo, conexao.guildId, pausado);
}

async function desligar(conexao) {
  if (conexao.tipo === 'global') {
    await Guild.updateOne(
      { guildId: conexao.guildId, canalId: conexao.canalId },
      { canalId: null, pausado: false, filtrarPalavroes: true, filtrarLinks: false }
    );
    limparFalhasDestino(conexao.guildId);
    return;
  }
  await removerParticipante(conexao.ponte, conexao.guildId);
}

module.exports = { conexaoDoCanal, definirPausa, desligar };
