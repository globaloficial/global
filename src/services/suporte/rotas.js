const { SITE, DASH_SITE, LIMITES, PROVEDORES, suporteAtivo } = require('./config');
const sessao = require('./sessao');
const login = require('./login');
const conversas = require('./conversas');
const { log } = require('../../util/logger');

const janelas = new Map();

function limiteExcedido(chave) {
  const agora = Date.now();
  const atual = (janelas.get(chave) || []).filter((t) => agora - t < 60_000);
  atual.push(agora);
  janelas.set(chave, atual);
  return atual.length > LIMITES.requisicoesPorMinuto;
}

setInterval(() => {
  const agora = Date.now();
  for (const [chave, tempos] of janelas) {
    if (!tempos.some((t) => agora - t < 60_000)) janelas.delete(chave);
  }
}, 5 * 60_000).unref();

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];

    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho > LIMITES.corpoBytes) {
        reject(new conversas.ErroSuporte(413, 'Mensagem grande demais'));
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
        reject(new conversas.ErroSuporte(400, 'JSON inválido'));
      }
    });

    req.on('error', reject);
  });
}

function cabecalhosSuporte(extra = {}) {
  return {
    'Access-Control-Allow-Origin': SITE,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...extra
  };
}

function json(res, status, corpo, extra) {
  res.writeHead(status, cabecalhosSuporte(extra));
  res.end(JSON.stringify(corpo));
}

function redirecionar(res, destino, cookies = []) {
  const cabecalhos = { Location: destino, 'Cache-Control': 'no-store' };
  if (cookies.length) cabecalhos['Set-Cookie'] = cookies;
  res.writeHead(302, cabecalhos);
  res.end();
}

async function tratarAuth(req, res, url, partes) {
  const provedor = partes[1];
  if (!PROVEDORES[provedor]) return json(res, 404, { erro: 'Não encontrado' });

  if (partes[2] === 'callback') {
    try {
      const resultado = await login.concluirLogin(req, provedor, url);
      return redirecionar(res, resultado.destino, resultado.cookies);
    } catch (e) {
      log.error('SUPORTE', `Falha no login ${provedor}`, e);
      return redirecionar(res, e.destino || `${SITE}/?login=erro`, [sessao.limparCookie(sessao.COOKIE_ESTADO)]);
    }
  }

  const retorno = url.searchParams.get('retorno');
  const inicio = login.iniciarLogin(provedor, retorno);
  if (!inicio) return redirecionar(res, `${retorno === 'dash' ? DASH_SITE : SITE}/?login=indisponivel`);
  return redirecionar(res, inicio.url, [inicio.cookie]);
}

async function tratarSuporte(req, res, url, partes) {
  const usuario = sessao.usuarioDaRequisicao(req);

  if (partes[1] === 'eu' && req.method === 'GET') {
    return json(res, 200, { logado: Boolean(usuario), usuario });
  }

  if (partes[1] === 'sair' && req.method === 'POST') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessao.limparCookie(sessao.COOKIE_SESSAO) });
  }

  if (!usuario) return json(res, 401, { erro: 'Faça login para continuar' });
  if (limiteExcedido(`${usuario.plataforma}:${usuario.id}`)) {
    return json(res, 429, { erro: 'Muitas requisições. Aguarde um instante.' });
  }

  if (partes[1] !== 'conversas') return json(res, 404, { erro: 'Não encontrado' });

  const numero = partes[2];
  const corpo = req.method === 'GET' ? {} : await lerCorpo(req);

  if (!numero && req.method === 'GET') {
    return json(res, 200, { conversas: await conversas.listar(usuario, url.searchParams.get('status')) });
  }
  if (!numero && req.method === 'POST') {
    return json(res, 201, await conversas.criar(usuario, corpo));
  }
  if (numero && !partes[3] && req.method === 'GET') {
    return json(res, 200, await conversas.obter(usuario, numero));
  }
  if (numero && partes[3] === 'mensagens' && req.method === 'POST') {
    return json(res, 201, await conversas.responder(usuario, numero, corpo));
  }
  if (numero && !partes[3] && req.method === 'PATCH') {
    return json(res, 200, await conversas.mudarStatus(usuario, numero, corpo));
  }

  return json(res, 404, { erro: 'Não encontrado' });
}

async function tratarRotaSuporte(req, res, url) {
  if (!suporteAtivo()) return json(res, 503, { erro: 'Suporte indisponível' });

  const partes = url.pathname.split('/').filter(Boolean);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cabecalhosSuporte());
    return res.end();
  }

  if (partes[0] === 'suporte' && req.method !== 'GET' && req.headers.origin !== SITE) {
    return json(res, 403, { erro: 'Origem não permitida' });
  }

  try {
    if (partes[0] === 'auth') return await tratarAuth(req, res, url, partes);
    return await tratarSuporte(req, res, url, partes);
  } catch (e) {
    if (e instanceof conversas.ErroSuporte) return json(res, e.status, { erro: e.message });
    log.error('SUPORTE', 'Falha ao tratar a requisição', e);
    return json(res, 500, { erro: 'Erro interno' });
  }
}

const ehRotaSuporte = (pathname) => pathname.startsWith('/auth/') || pathname.startsWith('/suporte/');

module.exports = { tratarRotaSuporte, ehRotaSuporte };
