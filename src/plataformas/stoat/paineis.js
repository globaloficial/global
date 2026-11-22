const Painel = require('../../models/Painel');
const { alterarPainelPorChave } = require('../../services/paineis');
const { log, errMsg } = require('../../util/logger');
const api = require('./api');
const dados = require('./dados');
const { IDS } = require('./emojis');
const { enviarComArquivos, podeGerenciar } = require('./compat');
const { embedsDoTexto } = require('./texto');

const EMOJI_DA_CHAVE = {
  modo: 'chat1fill',
  icone: 'imagefill',
  info: 'information2fill',
  recebidas: 'windowfill',
  palavroes: 'chatprivatefill',
  links: 'externallinkfill'
};

const CHAVE_DO_EMOJI = Object.fromEntries(Object.entries(EMOJI_DA_CHAVE).map(([chave, nome]) => [IDS[nome], chave]));

async function abrirPainelStoat(message, tipo, embeds, chaves, guildId) {
  const painel = await enviarComArquivos(message.channelId, { embeds });
  await Painel.create({ messageId: String(painel._id), guildId: String(guildId), userId: String(message.author.id), tipo });
  for (const chave of chaves) {
    await api.reagirMensagem(message.channelId, painel._id, IDS[EMOJI_DA_CHAVE[chave]]);
  }
  return true;
}

async function tratarReacaoPainelStoat(evento) {
  const chave = CHAVE_DO_EMOJI[evento.emoji_id];
  if (!chave || evento.user_id === dados.meuId()) return false;

  const painel = await Painel.findOne({ messageId: String(evento.id) }).lean();
  if (!painel || painel.userId !== String(evento.user_id)) return false;

  const servidor = await dados.obterServidor(painel.guildId).catch(() => null);
  if (!(await podeGerenciar(servidor, evento.user_id))) return false;

  const resultado = await alterarPainelPorChave(painel.tipo, chave, painel.guildId, 'stoat');
  if (!resultado) return false;

  try {
    await api.requisitar(
      'DELETE',
      `/channels/${evento.channel_id}/messages/${evento.id}/reactions/${encodeURIComponent(evento.emoji_id)}?user_id=${encodeURIComponent(evento.user_id)}`
    );
  } catch (e) {
    log.warn('PAINEL', `Não consegui remover a reação do painel ${evento.id}: ${errMsg(e)}`);
  }

  await api.editarMensagem(evento.channel_id, evento.id, { embeds: embedsDoTexto({ embeds: resultado.embeds }) });
  log.ok('PAINEL', `${painel.tipo} alterado por ${evento.user_id} no servidor ${painel.guildId}`);
  return true;
}

module.exports = { abrirPainelStoat, tratarReacaoPainelStoat };
