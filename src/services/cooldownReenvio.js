const { reagir, desreagir } = require('../util/reacoes');
const { linkDaMensagem } = require('../util/linkMensagem');
const { IDS } = require('../plataformas/stoat/emojis');
const { log, errMsg } = require('../util/logger');

const JANELA_MS = 30 * 60 * 1000;
const TAMANHO_PREVIA = 40;

const FLUXER = {
  erro: '<:closecirclefill:1562606683371339786>',
  reenviar: '<:restartfill:1576011387614793728>',
  sucesso: '<:checkboxcirclefill:1562606683371339777>'
};
const STOAT = {
  erro: `:${IDS.closecirclefill}:`,
  reenviar: `:${IDS.restartfill}:`,
  sucesso: `:${IDS.checkboxcirclefill}:`
};

const IDS_ERRO = new Set(['1562606683371339786', '1571357854995189881', IDS.closecirclefill]);
const IDS_REENVIAR = new Set(['1576011387614793728', '1576011945847292036', IDS.restartfill]);

const pendentes = new Map();

function emojiDe(plataforma, tipo) {
  return (plataforma === 'stoat' ? STOAT : FLUXER)[tipo];
}

function tipoDoEmoji(emoji) {
  const id = typeof emoji === 'string' ? emoji : emoji && emoji.id;
  if (!id) return null;
  if (IDS_ERRO.has(String(id))) return 'erro';
  if (IDS_REENVIAR.has(String(id))) return 'reenviar';
  return null;
}

function previaDaMensagem(message) {
  const texto = String(message.content || '')
    .replace(/[[\]()<>]/g, '')
    .replace(/@/g, '@​')
    .replace(/\s+/g, ' ')
    .trim();
  if (!texto) return 'mensagem...';
  return texto.length > TAMANHO_PREVIA ? `${texto.slice(0, TAMANHO_PREVIA).trimEnd()}...` : `${texto}...`;
}

function textoDoAviso(entrada) {
  const { message, plataforma } = entrada;
  const link = linkDaMensagem(plataforma, message, message.id);
  return `# ${FLUXER.erro} Mensagem não enviada\nA mensagem [${previaDaMensagem(message)}](<${link}>) não foi enviada porque ela entrou em cooldown, aperte a reação ${FLUXER.reenviar} para reenviar a mensagem.`;
}

function esquecer(chave) {
  const entrada = pendentes.get(chave);
  if (!entrada) return;
  clearTimeout(entrada.timer);
  pendentes.delete(chave);
}

async function marcarBloqueada(message, reenviar) {
  const plataforma = message.plataforma || 'fluxer';
  const chave = `${plataforma}:${message.id}`;
  if (!pendentes.has(chave)) {
    const entrada = {
      message,
      plataforma,
      autorId: String(message.author.id),
      reenviar,
      avisos: new Map(),
      reenviando: false,
      timer: null
    };
    entrada.timer = setTimeout(() => pendentes.delete(chave), JANELA_MS);
    if (entrada.timer.unref) entrada.timer.unref();
    pendentes.set(chave, entrada);
  }
  await reagir(message, [emojiDe(plataforma, 'erro')]);
  await reagir(message, [emojiDe(plataforma, 'reenviar')]);
}

async function avisar(entrada, usuarioId) {
  const agora = Date.now();
  const ultimo = entrada.avisos.get(usuarioId);
  if (ultimo && agora - ultimo < JANELA_MS) return;
  entrada.avisos.set(usuarioId, agora);
  try {
    await entrada.message.reply(textoDoAviso(entrada));
  } catch (e) {
    log.warn('COOLDOWN', `Falha ao avisar mensagem não enviada: ${errMsg(e)}`);
  }
}

async function reenviarMensagem(chave, entrada) {
  entrada.reenviando = true;
  try {
    await entrada.reenviar();
  } catch (e) {
    entrada.reenviando = false;
    log.error('COOLDOWN', 'Erro ao reenviar mensagem', e);
    return;
  }
  esquecer(chave);
  const { message, plataforma } = entrada;
  await desreagir(message, emojiDe(plataforma, 'erro'));
  await desreagir(message, emojiDe(plataforma, 'reenviar'));
  await reagir(message, [emojiDe(plataforma, 'sucesso')]);
}

async function tratarReacaoBloqueada({ msgId, emoji, emojiId, usuarioId, plataforma }) {
  const chave = `${plataforma || 'fluxer'}:${msgId}`;
  const entrada = pendentes.get(chave);
  if (!entrada) return false;
  const tipo = tipoDoEmoji(emojiId || emoji);
  if (!tipo) return false;
  const quem = String(usuarioId);
  if (tipo === 'erro') {
    await avisar(entrada, quem);
    return true;
  }
  if (quem !== entrada.autorId || entrada.reenviando) return true;
  await reenviarMensagem(chave, entrada);
  return true;
}

module.exports = { marcarBloqueada, tratarReacaoBloqueada, tipoDoEmoji, previaDaMensagem, textoDoAviso, JANELA_MS };
