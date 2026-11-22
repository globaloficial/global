const { EmbedBuilder } = require('@fluxerjs/core');
const { client } = require('../lib/client');
const Guild = require('../models/Guild');
const Painel = require('../models/Painel');
const { MODO_ENVIO, ehDev, PREFIXO } = require('../config');
const { membroPodeGerenciarCanais } = require('./permissoes');
const { log, errMsg } = require('../util/logger');
const { EMOJI } = require('../util/respostas');

const COR = 0x0330EF;

const REACAO_MODO = '<:chat1fill:1569877160041132032>';
const REACAO_ICONE = '<:imagefill:1569878138362535939>';
const REACAO_INFO = EMOJI.info;
const REACAO_PALAVROES = EMOJI.privado;
const REACAO_LINKS = EMOJI.externo;

const PADRAO_CUSTOMIZADO = /^<a?:([^:]+):(\d+)>$/;

function emojiParaAPI(emoji) {
  const m = String(emoji).match(PADRAO_CUSTOMIZADO);
  return m ? `${m[1]}:${m[2]}` : emoji;
}

function mesmoEmoji(recebido, configurado) {
  const custom = configurado.match(PADRAO_CUSTOMIZADO);
  if (!custom) return false;
  if (recebido && typeof recebido === 'object') return String(recebido.id) === custom[2];
  return String(recebido || '').endsWith(`:${custom[2]}`);
}

function verbo(discord, emoji) {
  return discord ? `Clique em ${emoji}` : `Reaja com ${emoji}`;
}

function modoDoServidor(config) {
  return config.modoEnvio || MODO_ENVIO;
}

function infoVisivel(config) {
  return !(config.ocultarServidor && config.ocultarPerfil);
}

function chave(ligado) {
  return ligado ? EMOJI.ligado : EMOJI.desligado;
}

function estadoDoWebhook(config) {
  if (modoDoServidor(config) !== 'webhook') return 'Desligado (modo embed)';
  if (config.webhookId && config.webhookCanalId === config.canalId) return 'Ativo';
  return 'Ainda não criado (criado na primeira mensagem, precisa da permissão **Gerenciar Webhooks**)';
}

function embedConfig(config = {}, plataforma = 'fluxer') {
  const discord = plataforma === 'discord';
  const webhook = modoDoServidor(config) === 'webhook';
  const canal = config.canalId ? `<#${config.canalId}>` : `Não conectado, use \`${PREFIXO}conectar\``;
  const icone = webhook
    ? 'Desativado automaticamente *(incompatibilidade por Webhooks, altere para o modo Embed para habilitar)*'
    : `${config.mostrarIcone ? 'Ativado' : 'Desativado'} *(aparece no rodapé das mensagens em embed)*`;
  const informacoes = `${infoVisivel(config) ? 'Ativado' : 'Desativado'} *(mostra informações como nome do servidor, link para ver o perfil do usuário e entre outras informações, aparece sempre abaixo de cada mensagem)*`;

  const principal = new EmbedBuilder()
    .setColor(COR)
    .setTitle(`${EMOJI.editar} Configurações do Servidor`)
    .setDescription(discord ? 'Configure o seu Global usando os botões abaixo.' : 'Configure o seu Global usando as reações abaixo, até o Fluxer colocar botões...')
    .addFields(
      { name: `${chave(!!config.canalId)} Canal da Conexão Global:`, value: canal, inline: true },
      { name: `${chave(webhook)} Modo de envio:`, value: webhook ? 'Webhook *(Personalizado)*' : 'Embed *(Padrão)*', inline: true },
      { name: `${chave(webhook && !!config.webhookId)} Estado do Webhook:`, value: estadoDoWebhook(config), inline: true },
      { name: `${chave(config.filtrarPalavroes !== false)} Filtro de Palavrões:`, value: `${config.filtrarPalavroes !== false ? 'Ativo' : 'Desativado'} *(por padrão)*`, inline: true },
      { name: `${chave(!webhook && !!config.mostrarIcone)} Ícone do Servidor (Embed):`, value: icone, inline: true },
      { name: `${chave(infoVisivel(config))} Informações de Mensagens:`, value: informacoes, inline: true }
    );

  const guia = new EmbedBuilder()
    .setColor(COR)
    .setTitle('Guia para configurações:')
    .addFields(
      { name: 'Alterar Modo de Envio:', value: `${verbo(discord, REACAO_MODO)} para habilitar/desabilitar`, inline: true },
      { name: 'Alterar Ícone de Servidores:', value: `${verbo(discord, REACAO_ICONE)} para habilitar/desabilitar`, inline: true },
      { name: 'Alterar Info. de Mensagens:', value: `${verbo(discord, REACAO_INFO)} para habilitar/desabilitar`, inline: true },
      { name: 'Remover a conexão global:', value: `\`${PREFIXO}desconectar\``, inline: true },
      { name: 'Alterar Filtro de Palavrões:', value: `\`${PREFIXO}automod\``, inline: true },
      { name: 'Alterar Filtro de Links:', value: `\`${PREFIXO}automod\``, inline: true }
    );

  return [principal, guia];
}

function embedAutomod(config = {}, plataforma = 'fluxer') {
  const discord = plataforma === 'discord';
  const palavroes = config.filtrarPalavroes !== false;
  const links = !!config.filtrarLinks;

  const principal = new EmbedBuilder()
    .setColor(COR)
    .setTitle(`${EMOJI.editar} Configurações dos Filtros`)
    .addFields(
      {
        name: `${chave(palavroes)} Filtro de Palavrões:`,
        value: `${palavroes ? 'Ativo' : 'Desativado'} *(Filtra palavrões, palavras de baixo-calão e linguagem inapropriada, o filtro pode acabar cometendo erros)*.`,
        inline: true
      },
      {
        name: `${chave(links)} Filtro de Links:`,
        value: `${links ? 'Ativo' : 'Desativado'} *(Filtra links de outros servidores, incluindo Fluxer e Discord, o filtro pode acabar cometendo erros)*.`,
        inline: true
      },
      {
        name: `${EMOJI.info} Nossos filtros não funcionaram em alguma mensagem?`,
        value: `Denuncie qualquer mensagem escrevendo \`${PREFIXO}report\` (com o reply ativado) na mensagem que você queira denunciar, as denúncias são revisadas por *um humano*.`,
        inline: true
      }
    );

  const guia = new EmbedBuilder()
    .setColor(COR)
    .setTitle('Guia para configurações:')
    .addFields(
      { name: 'Alterar Filtro de Palavrões:', value: `${verbo(discord, REACAO_PALAVROES)} para habilitar/desabilitar *(filtro habilitado por padrão)*`, inline: true },
      { name: 'Alterar Filtro de Links:', value: `${verbo(discord, REACAO_LINKS)} para habilitar/desabilitar *(filtro desabilitado por padrão)*`, inline: true },
      { name: 'Em breve: Dashboard do Global', value: 'Cansado de configurar por comandos? Estamos desenvolvendo uma ferramenta pra você, configure o Global do seu jeito *sem complicações*.', inline: true }
    );

  return [principal, guia];
}

const BOTOES = {
  config: [
    { chave: 'modo', rotulo: 'Modo de envio', emoji: REACAO_MODO },
    { chave: 'icone', rotulo: 'Ícone', emoji: REACAO_ICONE },
    { chave: 'info', rotulo: 'Informações', emoji: REACAO_INFO }
  ],
  automod: [
    { chave: 'palavroes', rotulo: 'Palavrões', emoji: REACAO_PALAVROES },
    { chave: 'links', rotulo: 'Links', emoji: REACAO_LINKS }
  ]
};

const EMOJI_POR_CHAVE = {
  modo: REACAO_MODO,
  icone: REACAO_ICONE,
  info: REACAO_INFO,
  palavroes: REACAO_PALAVROES,
  links: REACAO_LINKS
};

function botoesDoPainel(tipo, userId) {
  return BOTOES[tipo].map((b) => ({
    id: `painel|${tipo}|${b.chave}|${userId}`,
    rotulo: b.rotulo,
    emoji: b.emoji,
    estilo: 'secondary'
  }));
}

const TIPOS = {
  config: {
    embeds: embedConfig,
    reacoes: [REACAO_MODO, REACAO_ICONE, REACAO_INFO],
    alteracao(emoji, config) {
      if (mesmoEmoji(emoji, REACAO_MODO)) return { modoEnvio: modoDoServidor(config) === 'webhook' ? 'embed' : 'webhook' };
      if (mesmoEmoji(emoji, REACAO_ICONE)) return { mostrarIcone: !config.mostrarIcone };
      if (mesmoEmoji(emoji, REACAO_INFO)) {
        const esconder = infoVisivel(config);
        return { ocultarServidor: esconder, ocultarPerfil: esconder };
      }
      return null;
    }
  },
  automod: {
    embeds: embedAutomod,
    reacoes: [REACAO_PALAVROES, REACAO_LINKS],
    alteracao(emoji, config) {
      if (mesmoEmoji(emoji, REACAO_PALAVROES)) return { filtrarPalavroes: config.filtrarPalavroes === false };
      if (mesmoEmoji(emoji, REACAO_LINKS)) return { filtrarLinks: !config.filtrarLinks };
      return null;
    }
  }
};

async function abrirPainel(message, tipo, guildId) {
  const definicao = TIPOS[tipo];
  const atual = await Guild.findOne({ guildId: String(guildId) }).lean();
  if (message.plataforma === 'discord') {
    try {
      await message.reply({ embeds: definicao.embeds(atual || {}, 'discord'), botoes: botoesDoPainel(tipo, message.author.id) });
      return true;
    } catch (e) {
      log.error('PAINEL', `Falha ao publicar o painel ${tipo}: ${errMsg(e)}`, e);
      return false;
    }
  }
  if (message.plataforma === 'stoat') {
    try {
      const { abrirPainelStoat } = require('../plataformas/stoat/paineis');
      return await abrirPainelStoat(message, tipo, definicao.embeds(atual || {}, 'stoat'), BOTOES[tipo].map((b) => b.chave), guildId);
    } catch (e) {
      log.error('PAINEL', `Falha ao publicar o painel ${tipo}: ${errMsg(e)}`, e);
      return false;
    }
  }
  let painel = null;
  try {
    painel = await message.channel.send({ embeds: definicao.embeds(atual || {}), allowedMentions: { parse: [] } });
    await Painel.create({ messageId: String(painel.id), guildId: String(guildId), userId: String(message.author.id), tipo });
    for (const emoji of definicao.reacoes) await painel.react(emojiParaAPI(emoji));
    return true;
  } catch (e) {
    if (painel && typeof painel.delete === 'function') await painel.delete().catch(() => {});
    log.error('PAINEL', `Falha ao publicar o painel ${tipo}: ${errMsg(e)}`, e);
    return false;
  }
}

async function resolverMensagem(payload) {
  const direta = payload.message || (payload.reaction && payload.reaction.message);
  if (direta) return direta;
  if (payload.reaction && typeof payload.reaction.fetchMessage === 'function') return payload.reaction.fetchMessage();
  return null;
}

function autorComoMensagem(payload, message, user, guildId) {
  const guildDoPayload = (payload.reaction && payload.reaction.guild)
    || (payload.channel && payload.channel.guild)
    || (client.guilds && client.guilds.get(guildId))
    || null;
  const membro = payload.member || null;

  return {
    author: user,
    resolveGuild: async () => {
      if (typeof message.resolveGuild === 'function') {
        const guild = await message.resolveGuild();
        if (guild) return guild;
      }
      if (guildDoPayload) return guildDoPayload;
      if (membro) {
        return {
          members: { get: (id) => (id === String(user.id) ? membro : null) },
          fetchMember: async () => membro
        };
      }
      return null;
    }
  };
}

async function tratarReacaoPainel(payload) {
  try {
    const user = payload.user || (payload.member && payload.member.user) || { id: payload.userId };
    const userId = String(payload.userId || user.id || '');
    if (!userId || user.bot || (client.user && userId === String(client.user.id))) return false;

    const emoji = payload.emoji || (payload.reaction && payload.reaction.emoji);
    const message = await resolverMensagem(payload);
    if (!message) return false;

    const messageId = String(payload.messageId || message.id || '');
    const painel = messageId ? await Painel.findOne({ messageId }).lean() : null;
    if (!painel || painel.userId !== userId) return false;

    const definicao = TIPOS[painel.tipo];
    const guildId = painel.guildId;

    if (!ehDev(userId) && !(await membroPodeGerenciarCanais(autorComoMensagem(payload, message, user, guildId)))) return false;

    const config = (await Guild.findOne({ guildId }).lean()) || {};
    const alteracao = definicao.alteracao(emoji, config);
    if (!alteracao) return false;

    await Guild.updateOne({ guildId }, { $set: alteracao }, { upsert: true });

    const emojiConfigurado = definicao.reacoes.find((r) => mesmoEmoji(emoji, r));
    try {
      await message.removeReaction(emojiParaAPI(emojiConfigurado), userId);
    } catch (e) {
      log.warn('PAINEL', `Não consegui remover a reação do painel ${messageId}: ${errMsg(e)}`);
    }

    const atualizado = await Guild.findOne({ guildId }).lean();
    try {
      await message.edit({ embeds: definicao.embeds(atualizado || {}), allowedMentions: { parse: [] } });
    } catch (e) {
      log.error('PAINEL', `Configuração salva, mas o painel ${messageId} não pôde ser atualizado`, e);
    }

    log.ok('PAINEL', `${painel.tipo} alterado por ${userId} no servidor ${guildId}`);
    return true;
  } catch (e) {
    log.error('PAINEL', 'Erro ao processar reação do painel', e);
    return false;
  }
}

async function alterarPainelPorChave(tipo, chaveAcao, guildId, plataforma = 'discord') {
  const definicao = TIPOS[tipo];
  const emoji = EMOJI_POR_CHAVE[chaveAcao];
  if (!definicao || !emoji) return null;
  const config = (await Guild.findOne({ guildId: String(guildId) }).lean()) || {};
  const alteracao = definicao.alteracao({ id: emoji.match(/:(\d+)>$/)[1] }, config);
  if (!alteracao) return null;
  await Guild.updateOne({ guildId: String(guildId) }, { $set: alteracao }, { upsert: true });
  const atualizado = (await Guild.findOne({ guildId: String(guildId) }).lean()) || {};
  return { embeds: definicao.embeds(atualizado, plataforma), botoes: null };
}

module.exports = { abrirPainel, tratarReacaoPainel, embedConfig, embedAutomod, botoesDoPainel, alterarPainelPorChave };
