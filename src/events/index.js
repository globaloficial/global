const { Events } = require('@fluxerjs/core');
const { client } = require('../lib/client');
const { SUPORTE_GUILD_ID, SUPORTE_CANAL_BOAS_VINDAS } = require('../config');
const Guild = require('../models/Guild');
const User = require('../models/User');
const { removerConexaoDeGuild } = require('../services/destinos');
const { sincronizarEdicao } = require('../services/chat/sincronizacao');
const { retransmitirMensagemGlobal } = require('../services/chat/retransmissao');
const { aoApagarOriginal } = require('../services/chat/exclusao');
const { pontePorCanal } = require('../services/pontes');
const { tratarComando } = require('../handlers/commandHandler');
const { idDoServidor } = require('../util/ids');
const { log, descreverContexto } = require('../util/logger');
const { iniciarStatusRotativo } = require('../services/status');
const { tratarReacaoPainel } = require('../services/paineis');
const { espelharReacao, removerReacao } = require('../services/reacoes');

function registrarEventos() {
  const dadosDaReacao = (payload) => {
    const usuario = payload.user || (payload.member && payload.member.user) || {};
    const usuarioId = String(payload.userId || usuario.id || '');
    const doProprioBot = client.user && usuarioId === String(client.user.id);
    return {
      msgId: payload.messageId || (payload.message && payload.message.id),
      emoji: payload.emoji || (payload.reaction && payload.reaction.emoji),
      usuarioId,
      plataforma: 'fluxer',
      bot: Boolean(usuario.bot) || Boolean(doProprioBot)
    };
  };
  const espelhar = (payload) => espelharReacao(dadosDaReacao(payload))
    .catch((e) => log.warn('REACAO', `Falha ao espelhar reação: ${e && e.message}`));

  if (Events.MessageReactionRemove) {
    client.on(Events.MessageReactionRemove, async (payload) => {
      const dados = dadosDaReacao(payload);
      if (!dados.bot) await removerReacao(dados).catch(() => {});
    });
  }

  client.on(Events.MessageReactionAdd, async (payload) => {
    if (await tratarReacaoPainel(payload)) return;
    await espelhar(payload);
  });

  client.on(Events.MessageReactionAddMany, async (payload) => {
    for (const reacao of payload.reactions || []) {
      const individual = { ...payload, userId: reacao.userId, member: reacao.member, emoji: reacao.emoji };
      if (await tratarReacaoPainel(individual)) continue;
      await espelhar(individual);
    }
  });

  client.on(Events.Ready, async () => {
    const [canais, staffs] = await Promise.all([
      Guild.countDocuments({ canalId: { $ne: null } }),
      User.countDocuments({ staff: true })
    ]);
    log.ok('BOT', `Conectado como ${client.user.username} (${client.user.id}) | ${canais} servidor(es) conectado(s) | ${staffs} staff(s)`);
    iniciarStatusRotativo();
  });

  client.on(Events.GuildDelete, async (guild) => {
    try {
      await removerConexaoDeGuild(guild.id);
    } catch (e) {
      log.error('LIMPEZA', 'Erro ao tratar GuildDelete', e);
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.webhookId || message.author.id === client.user.id) return;

    try {
      const conteudo = message.content ? message.content.trim() : '';

      if (conteudo.includes(`<@${client.user.id}>`)) {
        log.info('MENCAO', descreverContexto(message));
        await message.channel.send('<:earthline1:1562606683371339780> Olá, eu sou o **Global**, eu conecto comunidades através de um chat global e o meu prefixo é `g.`, caso você gostar de mim, que tal me [adicionar em seu servidor?](<https://web.fluxer.app/oauth2/authorize?client_id=1562253521942745089&scope=bot&permissions=4503600164629568>)');
        return;
      }

      if (await tratarComando(message, conteudo)) return;

      const ponte = await pontePorCanal(message.channel.id);
      if (ponte) {
        await retransmitirMensagemGlobal(message, ponte);
        return;
      }

      const guildId = idDoServidor(message);
      if (guildId) {
        const row = await Guild.findOne({ guildId: String(guildId) }).lean();
        if (row && message.channel.id === row.canalId) {
          if (row.pausado) return;
          await retransmitirMensagemGlobal(message);
        }
      }
    } catch (e) {
      log.error('MSG', `Erro ao processar mensagem ${message.id} de ${descreverContexto(message)}`, e);
    }
  });

  client.on(Events.MessageUpdate, async (antiga, nova) => {
    try {
      await sincronizarEdicao(antiga, nova);
    } catch (e) {
      log.error('SYNC', 'Erro ao sincronizar edição', e);
    }
  });

  client.on(Events.MessageDelete, async (msg) => {
    try {
      if (!msg || !msg.id) return;
      await aoApagarOriginal(msg.id);
    } catch (e) {
      log.error('SYNC', 'Erro ao sincronizar exclusão', e);
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    const guildId = member.guild ? member.guild.id : /** @type {any} */ (member).guildId;
    if (guildId !== SUPORTE_GUILD_ID) return;
    if (member.user && member.user.bot) return;

    const userId = member.user ? member.user.id : member.id;

    try {
      /** @type {any} */
      const canal = await client.channels.fetch(SUPORTE_CANAL_BOAS_VINDAS);
      if (!canal) return;
      await canal.send(`<:heart2fill:1562975992086007808> Saalve <@${userId}>, bem-vindo(a) a minha casa, o lugar onde surgi e cresci, aqui leia sobre minhas atualizações, erros e entre outras coisas...`);
      log.info('BOAS-VINDAS', `Novo membro no servidor de suporte: ${userId}`);
    } catch (e) {
      log.error('BOAS-VINDAS', 'Falha ao enviar mensagem', e);
    }
  });
}

module.exports = { registrarEventos };
