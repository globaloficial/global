const { espelharReacao, removerReacao } = require('../../services/reacoes');
const { PREFIXO } = require('../../config');
const Guild = require('../../models/Guild');
const { removerConexaoDeGuild } = require('../../services/destinos');
const { sincronizarEdicao } = require('../../services/chat/sincronizacao');
const { retransmitirMensagemGlobal } = require('../../services/chat/retransmissao');
const { aoApagarOriginal } = require('../../services/chat/exclusao');
const { pontePorCanal } = require('../../services/pontes');
const { tratarComando } = require('../../handlers/commandHandler');
const { log, errMsg, descreverContexto } = require('../../util/logger');
const api = require('./api');
const dados = require('./dados');
const { criarMensagemCompat } = require('./compat');
const { tratarReacaoPainelStoat } = require('./paineis');

const CATEGORIAS = ['conexao', 'geral'];

const COMANDOS_STOAT = new Set([
  'conectar', 'connect',
  'desconectar',
  'pausar',
  'retomar',
  'ponte', 'bridge', 'pontes',
  'config', 'configurar', 'configurações',
  'automod', 'moderacao',
  'botinfo', 'global',
  'ping',
  'perfil', 'profile',
  'destacar', 'selecionar',
  'report', 'denunciar',
  'ajuda', 'help', 'comandos',
  'verreacao', 'verreação', 'reacao', 'reação', 'inforeacao', 'inforeação'
]);

function comandoDisponivel(conteudo) {
  if (!conteudo.startsWith(PREFIXO)) return false;
  const nome = conteudo.slice(PREFIXO.length).trim().split(/\s+/)[0];
  return COMANDOS_STOAT.has((nome || '').toLowerCase());
}

async function aoCriarMensagem(raw) {
  if (raw.system || !raw.author || raw.author === dados.meuId()) return;

  const canal = await dados.obterCanal(raw.channel);
  if (!canal || !canal.server) return;

  const autor = await dados.obterUsuario(raw.author);
  if (!autor || autor.bot || raw.masquerade) return;

  const message = await criarMensagemCompat(raw);
  const conteudo = raw.content ? raw.content.trim() : '';

  if (conteudo === `<@${dados.meuId()}>`) {
    log.info('MENCAO', descreverContexto(message));
    await message.channel.send(`Olá, eu sou o **Global**, eu conecto comunidades através de um chat global e o meu prefixo é \`${PREFIXO}\`.`);
    return;
  }

  if (comandoDisponivel(conteudo) && await tratarComando(message, conteudo, CATEGORIAS)) return;

  const ponte = await pontePorCanal(raw.channel);
  if (ponte) {
    await retransmitirMensagemGlobal(message, ponte);
    return;
  }

  const row = await Guild.findOne({ guildId: String(message.guildId) }).lean();
  if (!row || row.plataforma !== 'stoat') return;
  if (String(raw.channel) !== String(row.canalId) || row.pausado) return;

  await retransmitirMensagemGlobal(message);
}

async function aoAtualizarMensagem(evento) {
  const novo = evento.data || {};
  if (novo.content === undefined) return;
  await sincronizarEdicao(
    { content: null },
    { id: evento.id, content: novo.content, channelId: evento.channel, plataforma: 'stoat' }
  );
}

function emojiDaReacao(emojiId) {
  return dados.ehUlid(emojiId) ? { id: emojiId, name: null } : { id: null, name: emojiId };
}

async function dadosDaReacao(evento) {
  const usuario = evento.user_id === dados.meuId() ? null : await dados.obterUsuario(evento.user_id).catch(() => null);
  return {
    msgId: evento.id,
    emoji: emojiDaReacao(evento.emoji_id),
    emojiId: evento.emoji_id,
    usuarioId: evento.user_id,
    plataforma: 'stoat',
    bot: evento.user_id === dados.meuId() || Boolean(usuario && usuario.bot)
  };
}

async function aoEvento(evento) {
  switch (evento.type) {
    case 'Authenticated':
      return;
    case 'Ready':
      dados.aplicarPronto(evento);
      log.ok('STOAT', `Pronto | ${(evento.servers || []).length} servidor(es)`);
      return;
    case 'Message':
      await aoCriarMensagem(evento);
      return;
    case 'MessageUpdate':
      await aoAtualizarMensagem(evento);
      return;
    case 'MessageDelete':
      await aoApagarOriginal(evento.id);
      return;
    case 'BulkMessageDelete':
      for (const id of evento.ids || []) await aoApagarOriginal(id);
      return;
    case 'MessageReact':
      if (await tratarReacaoPainelStoat(evento)) return;
      await espelharReacao(await dadosDaReacao(evento));
      return;
    case 'MessageUnreact': {
      const reacao = await dadosDaReacao(evento);
      if (!reacao.bot) await removerReacao(reacao);
      return;
    }
    case 'ServerCreate':
      dados.guardarServidor(evento.server);
      for (const canal of evento.channels || []) dados.guardarCanal(canal);
      return;
    case 'ServerUpdate':
      dados.atualizarServidor(evento.id, evento.data, evento.clear);
      return;
    case 'ServerDelete':
      dados.removerServidor(evento.id);
      await removerConexaoDeGuild(evento.id);
      return;
    case 'ServerMemberLeave':
      dados.esquecerMembro(evento.id, evento.user);
      if (evento.user === dados.meuId()) {
        dados.removerServidor(evento.id);
        await removerConexaoDeGuild(evento.id);
      }
      return;
    case 'ServerMemberUpdate':
      dados.esquecerMembro(evento.id.server, evento.id.user);
      return;
    case 'ChannelCreate':
      dados.guardarCanal(evento);
      return;
    case 'ChannelUpdate':
      dados.atualizarCanal(evento.id, evento.data, evento.clear);
      return;
    case 'ChannelDelete':
      dados.removerCanal(evento.id);
      return;
    case 'UserUpdate':
      dados.atualizarUsuario(evento.id, evento.data, evento.clear);
      return;
    default:
      return;
  }
}

function protegido(evento) {
  return aoEvento(evento).catch((e) => log.error('STOAT', `Erro no evento ${evento.type}: ${errMsg(e)}`, e));
}

async function carregarIdentidade() {
  const eu = await api.euMesmo();
  dados.definirEu(eu);
  return eu;
}

module.exports = { aoEvento: protegido, carregarIdentidade, comandoDisponivel, COMANDOS_STOAT };
