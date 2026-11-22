const api = require('./api');
const { log, errMsg } = require('../../util/logger');

const INTERVALO_PING_MS = 20_000;
const ESPERA_MIN_MS = 2_000;
const ESPERA_MAX_MS = 30_000;

function criarGateway({ token, aoEvento }) {
  let socket = null;
  let ping = null;
  let religar = null;
  let tentativas = 0;
  let parado = false;

  function limpar() {
    if (ping) clearInterval(ping);
    ping = null;
  }

  function agendar() {
    if (parado) return;
    const espera = Math.min(ESPERA_MAX_MS, ESPERA_MIN_MS * 2 ** Math.min(tentativas, 4));
    tentativas++;
    religar = setTimeout(conectar, espera);
  }

  async function conectar() {
    if (parado) return;
    try {
      await api.obterConfiguracao(true);
      const base = api.urlDoGateway();
      if (!base) throw new Error('URL do gateway ausente na configuração');
      const url = `${base}${base.includes('?') ? '&' : '?'}version=1&format=json&token=${encodeURIComponent(token)}`;
      socket = new WebSocket(url);
    } catch (e) {
      log.warn('STOAT', `Falha ao abrir o gateway: ${errMsg(e)}`);
      agendar();
      return;
    }

    const atual = socket;

    atual.addEventListener('open', () => {
      tentativas = 0;
      limpar();
      ping = setInterval(() => {
        try {
          atual.send(JSON.stringify({ type: 'Ping', data: Date.now() }));
        } catch (_) {
          return;
        }
      }, INTERVALO_PING_MS);
      if (typeof ping.unref === 'function') ping.unref();
    });

    atual.addEventListener('message', (evento) => {
      let dados;
      try {
        dados = JSON.parse(typeof evento.data === 'string' ? evento.data : String(evento.data));
      } catch (_) {
        return;
      }
      Promise.resolve()
        .then(() => aoEvento(dados))
        .catch((e) => log.error('STOAT', `Erro no evento ${dados && dados.type}: ${errMsg(e)}`, e));
    });

    atual.addEventListener('error', () => {
      log.warn('STOAT', 'Erro no gateway');
    });

    atual.addEventListener('close', () => {
      limpar();
      if (socket === atual) socket = null;
      if (!parado) {
        log.warn('STOAT', 'Gateway desconectado, reconectando...');
        agendar();
      }
    });
  }

  function parar() {
    parado = true;
    limpar();
    if (religar) clearTimeout(religar);
    if (socket) {
      try {
        socket.close();
      } catch (_) {
        socket = null;
      }
    }
  }

  return { conectar, parar };
}

module.exports = { criarGateway };
