const { log, errMsg } = require('./logger');
const { logRateLimit } = require('./ratelimit');
const { bloqueioAtivo } = require('../services/entrega/fila');

async function reagir(message, candidatos) {
  const bloqueado = typeof message.bloqueioAtivo === 'function' ? message.bloqueioAtivo() : bloqueioAtivo();
  if (bloqueado) return false;
  for (const emoji of candidatos) {
    try {
      await message.react(emoji);
      return true;
    } catch (e) {
      logRateLimit(e, `react "${emoji}" msg ${message.id}`);
      log.warn('REACT', `Falhou com "${emoji}": ${errMsg(e)}`);
    }
  }
  return false;
}

async function desreagir(message, emoji) {
  if (typeof message.desreagir === 'function') {
    try {
      await message.desreagir(emoji);
      return true;
    } catch (e) {
      logRateLimit(e, `desreagir "${emoji}" msg ${message.id}`);
      log.warn('REACT', `Falhou ao remover "${emoji}": ${errMsg(e)}`);
      return false;
    }
  }
  if (typeof message.removeReaction !== 'function') return false;
  const { client } = require('../lib/client');
  const botId = client.user && client.user.id;
  const encontrado = String(emoji).match(/^<a?:([\w~]+):(\d+)>$/);
  const formas = encontrado ? [emoji, `${encontrado[1]}:${encontrado[2]}`] : [emoji];
  for (const forma of formas) {
    try {
      await message.removeReaction(forma, botId);
      return true;
    } catch (e) {
      logRateLimit(e, `desreagir "${forma}" msg ${message.id}`);
    }
  }
  log.warn('REACT', `Falhou ao remover "${emoji}" da msg ${message.id}`);
  return false;
}

module.exports = { reagir, desreagir };
