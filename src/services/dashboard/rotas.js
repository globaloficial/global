const { DASH_SITE, LIMITES, suporteAtivo } = require('../suporte/config');
const sessao = require('../suporte/sessao');
const { criarLimitador } = require('../../util/limiteRequisicoes');
const { log } = require('../../util/logger');
const { ErroPainel } = require('./erros');
const servidores = require('./servidores');
const equipe = require('./equipe');

const limiteExcedido = criarLimitador({ maximo: 90 });
const limiteEscrita = criarLimitador({ maximo: 20 });

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];

    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho > LIMITES.corpoBytes) {
        reject(new ErroPainel(413, 'Requisição grande demais'));
        req.destroy();
        return;
      }
      partes.push(parte);
    });

    req.on('end', () => {
      if (!partes.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8')));
      } catch {
        reject(new ErroPainel(400, 'JSON inválido'));
      }
    });

    req.on('error', reject);
  });
}

function cabecalhos(extra = {}) {
  return {
    'Access-Control-Allow-Origin': DASH_SITE,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...extra
  };
}

function json(res, status, corpo, extra) {
  res.writeHead(status, cabecalhos(extra));
  res.end(JSON.stringify(corpo));
}

async function rotaDeServidor(req, res, usuario, partes, corpo) {
  const [, , plataforma, id, extra] = partes;

  if (!plataforma && req.method === 'GET') {
    return json(res, 200, { servidores: await servidores.listarServidores(usuario) });
  }
  if (plataforma && id && !extra && req.method === 'GET') {
    return json(res, 200, await servidores.detalhesDoServidor(usuario, plataforma, id));
  }
  if (plataforma && id && !extra && req.method === 'PATCH') {
    return json(res, 200, await servidores.alterarServidor(usuario, plataforma, id, corpo));
  }
  if (plataforma && id && extra === 'logs' && req.method === 'GET') {
    return json(res, 200, { logs: await servidores.logsDoServidor(usuario, plataforma, id) });
  }

  return json(res, 404, { erro: 'Não encontrado' });
}

async function rotaDaEquipe(req, res, usuario, partes, corpo) {
  const [, , recurso, tipo, id] = partes;

  if (recurso === 'servidores' && req.method === 'GET') {
    return json(res, 200, { servidores: await equipe.todosOsServidores(usuario) });
  }
  if (recurso === 'filtro' && req.method === 'GET') {
    return json(res, 200, await equipe.listarFiltro(usuario));
  }
  if (recurso === 'filtro' && req.method === 'POST') {
    return json(res, 200, await equipe.alterarFiltro(usuario, corpo));
  }
  if (recurso === 'bloqueios' && !tipo && req.method === 'GET') {
    return json(res, 200, { bloqueios: await equipe.listarBloqueios(usuario) });
  }
  if (recurso === 'bloqueios' && !tipo && req.method === 'POST') {
    return json(res, 200, { bloqueios: await equipe.bloquear(usuario, corpo) });
  }
  if (recurso === 'bloqueios' && tipo && id && req.method === 'DELETE') {
    return json(res, 200, { bloqueios: await equipe.desbloquear(usuario, tipo, id) });
  }

  return json(res, 404, { erro: 'Não encontrado' });
}

async function tratarRotaDash(req, res, url) {
  if (!suporteAtivo()) return json(res, 503, { erro: 'Painel indisponível' });

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cabecalhos());
    return res.end();
  }

  if (req.method !== 'GET' && req.headers.origin !== DASH_SITE) {
    return json(res, 403, { erro: 'Origem não permitida' });
  }

  const partes = url.pathname.split('/').filter(Boolean);
  const usuario = sessao.usuarioDaRequisicao(req);

  try {
    if (partes[1] === 'eu' && req.method === 'GET') {
      return json(res, 200, { logado: Boolean(usuario), usuario });
    }
    if (partes[1] === 'sair' && req.method === 'POST') {
      return json(res, 200, { ok: true }, { 'Set-Cookie': sessao.limparCookie(sessao.COOKIE_SESSAO) });
    }

    if (!usuario) return json(res, 401, { erro: 'Faça login para continuar' });

    const chave = `${usuario.plataforma}:${usuario.id}`;
    if (limiteExcedido(chave) || (req.method !== 'GET' && limiteEscrita(chave))) {
      return json(res, 429, { erro: 'Muitas requisições. Aguarde um instante.' });
    }

    const corpo = req.method === 'GET' || req.method === 'DELETE' ? {} : await lerCorpo(req);

    if (partes[1] === 'servidores') return await rotaDeServidor(req, res, usuario, partes, corpo);
    if (partes[1] === 'equipe') return await rotaDaEquipe(req, res, usuario, partes, corpo);

    return json(res, 404, { erro: 'Não encontrado' });
  } catch (e) {
    if (e instanceof ErroPainel) return json(res, e.status, { erro: e.message });
    log.error('PAINEL', 'Falha ao tratar a requisição', e);
    return json(res, 500, { erro: 'Erro interno' });
  }
}

const ehRotaDash = (pathname) => pathname.startsWith('/dash/');

module.exports = { tratarRotaDash, ehRotaDash };
