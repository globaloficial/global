const MensagemGlobal = require('../models/MensagemGlobal');
const ReacaoGlobal = require('../models/ReacaoGlobal');
const { obterPlataforma } = require('../plataformas');
const { bloqueioAtivo } = require('./entrega/fila');
const { tratarReacaoBloqueada } = require('./cooldownReenvio');
const { log, errMsg } = require('../util/logger');
const { logRateLimit } = require('../util/ratelimit');

const EMOJI_UNICODE = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣)/u;
const VALIDADE_MS = 60 * 60 * 1000;
const LIMITE_CACHE = 5000;
const LOTE = 5;

const jaEspelhadas = new Map();

function emojiUnicode(emoji) {
  if (!emoji) return null;
  if (typeof emoji === 'string') return EMOJI_UNICODE.test(emoji) ? emoji : null;
  if (emoji.id) return null;
  return emoji.name && EMOJI_UNICODE.test(emoji.name) ? emoji.name : null;
}

function jaFoiEspelhada(chave) {
  const agora = Date.now();
  if (jaEspelhadas.size > LIMITE_CACHE) {
    for (const [k, quando] of jaEspelhadas) if (agora - quando > VALIDADE_MS) jaEspelhadas.delete(k);
  }
  const anterior = jaEspelhadas.get(chave);
  if (anterior && agora - anterior < VALIDADE_MS) return true;
  jaEspelhadas.set(chave, agora);
  return false;
}

async function reagirNaCopia(linha, emoji) {
  const adaptador = obterPlataforma(linha.plataforma);
  if (!adaptador || !adaptador.buscarMensagem) return;
  try {
    const mensagem = await adaptador.buscarMensagem(linha.canalId, linha.msgId);
    await mensagem.react(emoji);
  } catch (e) {
    logRateLimit(e, `reação espelhada msg ${linha.msgId}`);
    log.warn('REACAO', `Não consegui reagir em ${linha.msgId}: ${errMsg(e)}`);
  }
}

async function registrarReacao({ msgId, emoji, usuarioId, plataforma }) {
  const unicode = emojiUnicode(emoji);
  if (!unicode) return null;
  const linha = await MensagemGlobal.findOne({ msgId: String(msgId) }).lean();
  if (!linha) return null;
  if (usuarioId) {
    await ReacaoGlobal.updateOne(
      { grupoId: linha.grupoId, usuarioId: String(usuarioId), emoji: unicode },
      { $setOnInsert: { plataforma: plataforma || 'fluxer', criadoEm: new Date() } },
      { upsert: true }
    );
  }
  return { linha, unicode };
}

async function removerReacao({ msgId, emoji, usuarioId }) {
  const unicode = emojiUnicode(emoji);
  if (!unicode || !usuarioId) return;
  const linha = await MensagemGlobal.findOne({ msgId: String(msgId) }).lean();
  if (!linha) return;
  await ReacaoGlobal.deleteMany({ grupoId: linha.grupoId, usuarioId: String(usuarioId), emoji: unicode });
}

async function espelharReacao({ msgId, emoji, emojiId, usuarioId, plataforma, bot }) {
  if (bot) return 0;
  if (await tratarReacaoBloqueada({ msgId, emoji, emojiId, usuarioId, plataforma })) return 0;
  if (bloqueioAtivo()) return 0;
  const registro = await registrarReacao({ msgId, emoji, usuarioId, plataforma });
  if (!registro) return 0;

  const { linha, unicode } = registro;
  if (jaFoiEspelhada(`${linha.grupoId}:${unicode}`)) return 0;

  const outras = await MensagemGlobal.find({ grupoId: linha.grupoId, msgId: { $ne: String(msgId) } }).lean();
  for (let i = 0; i < outras.length; i += LOTE) {
    await Promise.allSettled(outras.slice(i, i + LOTE).map((l) => reagirNaCopia(l, unicode)));
  }
  return outras.length;
}

module.exports = { espelharReacao, removerReacao, emojiUnicode };
