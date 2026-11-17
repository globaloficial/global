const http = require('http');
const { STATS_PORT, STATS_ORIGEM } = require('../config');
const { obterEstatisticas } = require('./estatisticas');
const { tratarRotaSuporte, ehRotaSuporte } = require('./suporte/rotas');
const { tratarRotaDash, ehRotaDash } = require('./dashboard/rotas');
const { log } = require('../util/logger');

const ORIGENS = STATS_ORIGEM.split(',').map((origem) => origem.trim()).filter(Boolean);

function cabecalhos(req) {
  const origem = req.headers.origin;

  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(origem) ? origem : ORIGENS[0],
    'Vary': 'Origin',
    'Cache-Control': 'public, max-age=30',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function responder(req, res, status, corpo) {
  res.writeHead(status, cabecalhos(req));
  res.end(JSON.stringify(corpo));
}

async function tratarRequisicao(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (ehRotaDash(url.pathname)) {
    await tratarRotaDash(req, res, url);
    return;
  }

  if (ehRotaSuporte(url.pathname)) {
    await tratarRotaSuporte(req, res, url);
    return;
  }

  if (req.method !== 'GET' || url.pathname !== '/stats') {
    responder(req, res, 404, { erro: 'Não encontrado' });
    return;
  }

  try {
    responder(req, res, 200, await obterEstatisticas());
  } catch (e) {
    log.error('API', 'Falha ao gerar as estatísticas', e);
    responder(req, res, 500, { erro: 'Estatísticas indisponíveis' });
  }
}

function iniciarApiPublica() {
  if (!STATS_PORT) return null;

  const servidor = http.createServer(tratarRequisicao);
  servidor.listen(STATS_PORT, () => log.ok('API', `Estatísticas em http://localhost:${STATS_PORT}/stats`));
  return servidor;
}

module.exports = { iniciarApiPublica };
