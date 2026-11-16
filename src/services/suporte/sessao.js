const crypto = require('crypto');
const { SEGREDO, DOMINIO_COOKIE, SESSAO_MS, PROVEDORES } = require('./config');

const COOKIE_SESSAO = 'gs_sessao';
const COOKIE_ESTADO = 'gs_estado';

function assinar(texto) {
  return crypto.createHmac('sha256', SEGREDO).update(texto).digest('base64url');
}

function empacotar(dados) {
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return `${corpo}.${assinar(corpo)}`;
}

function desempacotar(valor) {
  if (!valor || !valor.includes('.')) return null;

  const [corpo, assinatura] = valor.split('.');
  const esperada = assinar(corpo);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    return dados.exp > Date.now() ? dados : null;
  } catch {
    return null;
  }
}

function lerCookies(req) {
  const cookies = {};
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const indice = parte.indexOf('=');
    if (indice < 0) continue;
    cookies[parte.slice(0, indice).trim()] = decodeURIComponent(parte.slice(indice + 1).trim());
  }
  return cookies;
}

function montarCookie(nome, valor, maxAgeMs) {
  return [
    `${nome}=${encodeURIComponent(valor)}`,
    `Domain=${DOMINIO_COOKIE}`,
    'Path=/',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
}

function criarSessao(usuario) {
  const valor = empacotar({ ...usuario, exp: Date.now() + SESSAO_MS });
  return montarCookie(COOKIE_SESSAO, valor, SESSAO_MS);
}

function limparCookie(nome) {
  return montarCookie(nome, '', 0);
}

function criarEstado(provedor) {
  const estado = crypto.randomBytes(16).toString('hex');
  const valor = empacotar({ estado, provedor, exp: Date.now() + 10 * 60 * 1000 });
  return { estado, cookie: montarCookie(COOKIE_ESTADO, valor, 10 * 60 * 1000) };
}

function validarEstado(req, provedor, estado) {
  const dados = desempacotar(lerCookies(req)[COOKIE_ESTADO]);
  return Boolean(dados && estado && dados.provedor === provedor && dados.estado === estado);
}

function usuarioDaRequisicao(req) {
  const dados = desempacotar(lerCookies(req)[COOKIE_SESSAO]);
  if (!dados || !PROVEDORES[dados.plataforma]) return null;

  return {
    plataforma: dados.plataforma,
    id: dados.id,
    nome: dados.nome,
    avatar: dados.avatar,
    equipe: PROVEDORES[dados.plataforma].staff.includes(dados.id)
  };
}

module.exports = {
  COOKIE_SESSAO,
  COOKIE_ESTADO,
  criarSessao,
  limparCookie,
  criarEstado,
  validarEstado,
  usuarioDaRequisicao
};
