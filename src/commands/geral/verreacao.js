const { EmbedBuilder } = require('@fluxerjs/core');
const { PREFIXO } = require('../../config');
const MensagemGlobal = require('../../models/MensagemGlobal');
const ReacaoGlobal = require('../../models/ReacaoGlobal');
const { obterPlataforma } = require('../../plataformas');
const { previaDaMensagem } = require('../../services/chat/retransmissao');
const { urlDoPerfil } = require('../../services/chat/mensagem');
const { erroSimples, erro } = require('../../util/respostas');

const COR = 0x0330EF;
const LIMITE_LINHAS = 20;
const BARRA = '<:reply_l:1573758153441419265><:reply_r:1573758251432935424>';
const ROTULO_PLATAFORMA = { fluxer: 'Fluxer', discord: 'Discord' };

function etiqueta(plataforma, daPlataforma) {
  return plataforma === daPlataforma ? '' : `[${ROTULO_PLATAFORMA[plataforma] || plataforma}] `;
}

async function nomeDoUsuario(plataforma, usuarioId) {
  try {
    const adaptador = obterPlataforma(plataforma);
    const usuario = await adaptador.buscarUsuario(usuarioId);
    return usuario.globalName || usuario.displayName || usuario.username || 'Usuário desconhecido';
  } catch (_) {
    return 'Usuário desconhecido';
  }
}

function linkDaMensagem(plataforma, message, refId) {
  const base = plataforma === 'discord' ? 'https://discord.com/channels' : 'https://fluxer.com/channels';
  return `${base}/${message.guildId}/${message.channel.id}/${refId}`;
}

function nomeComLink(nome, plataforma, usuarioId) {
  const limpo = String(nome).replace(/[[\]]/g, '');
  return `[${limpo}](${urlDoPerfil(plataforma, usuarioId)})`;
}

module.exports = {
  name: 'verreacao',
  aliases: ['verreação', 'reacao', 'reação', 'inforeacao', 'inforeação'],
  description: 'Mostra quem reagiu à mensagem do Global que você respondeu.',

  async execute(message) {
    const plataforma = message.plataforma || 'fluxer';
    const refId = message.messageReference && message.messageReference.messageId;

    if (!refId) {
      await message.reply(erroSimples(
        'Cadê a mensagem?',
        `Você precisa **responder** uma mensagem do Global com o comando \`${PREFIXO}verreação\` para ver as reações dela.`
      ));
      return;
    }

    const linha = await MensagemGlobal.findOne({ msgId: String(refId) }).lean();
    if (!linha) {
      await message.reply(erro(
        'Mensagem inválida',
        'A mensagem que você respondeu não foi enviada pelo Global, responda uma mensagem de outro servidor (as enviadas por webhook ou embed do Global).'
      ));
      return;
    }

    const reacoes = await ReacaoGlobal.find({ grupoId: linha.grupoId }).sort({ criadoEm: 1 }).lean();
    if (reacoes.length === 0) {
      await message.reply(erroSimples(
        'Sem reações',
        'Essa mensagem ainda não recebeu nenhuma reação, que tal ser o primeiro?',
        { abaixo: 'Só aparecem reações feitas depois que o Global começou a registrá-las.' }
      ));
      return;
    }

    const origem = linha.msgId === linha.grupoId
      ? linha
      : (await MensagemGlobal.findOne({ msgId: linha.grupoId }).lean()) || linha;
    const previa = await previaDaMensagem(message, refId, origem);
    const nomeOrigem = previa.nome || 'Usuário desconhecido';
    const texto = previa.texto || 'mensagem';
    const trecho = `[${texto.replace(/[[\]]/g, '')}](${linkDaMensagem(plataforma, message, refId)})`;
    const autorOrigem = nomeComLink(nomeOrigem, origem.plataforma, origem.autorId);
    const cabecalho = `-# ${BARRA}${etiqueta(origem.plataforma, plataforma)}${autorOrigem}: ${trecho}`;

    const exibidas = reacoes.slice(0, LIMITE_LINHAS);
    const linhas = await Promise.all(exibidas.map(async (r) => {
      const nome = await nomeDoUsuario(r.plataforma, r.usuarioId);
      return `${etiqueta(r.plataforma, plataforma)}${nomeComLink(nome, r.plataforma, r.usuarioId)}: Reagiu com ${r.emoji}`;
    }));
    if (reacoes.length > exibidas.length) linhas.push(`-# e mais ${reacoes.length - exibidas.length} reação(ões)`);

    const separador = plataforma === 'discord' ? '\n---\n' : '\n\n';
    const embed = new EmbedBuilder()
      .setColor(COR)
      .setTitle('Reações da Mensagem')
      .setDescription(`${cabecalho}${separador}${linhas.join('\n')}`);

    await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
};
