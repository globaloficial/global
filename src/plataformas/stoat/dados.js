const api = require('./api');

const TTL_MS = 10 * 60_000;
const ALFABETO_ULID = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const usuarios = new Map();
const servidores = new Map();
const canais = new Map();
const membros = new Map();

let eu = null;

function guardar(mapa, chave, valor) {
  mapa.set(String(chave), { valor, ate: Date.now() + TTL_MS });
  return valor;
}

function lerCache(mapa, chave) {
  const item = mapa.get(String(chave));
  if (!item) return null;
  if (item.ate < Date.now()) {
    mapa.delete(String(chave));
    return null;
  }
  return item.valor;
}

async function comCache(mapa, chave, buscar) {
  const cacheado = lerCache(mapa, chave);
  if (cacheado) return cacheado;
  return guardar(mapa, chave, await buscar());
}

function obterUsuario(id) {
  return comCache(usuarios, id, () => api.obterUsuarioApi(id));
}

function obterCanal(id) {
  return comCache(canais, id, () => api.obterCanalApi(id));
}

function obterServidor(id) {
  return comCache(servidores, id, () => api.obterServidorApi(id));
}

async function obterMembro(servidorId, usuarioId) {
  try {
    return await comCache(membros, `${servidorId}:${usuarioId}`, () => api.obterMembroApi(servidorId, usuarioId));
  } catch (_) {
    return null;
  }
}

function servidorEmCache(id) {
  return lerCache(servidores, id);
}

function usuarioEmCache(id) {
  return lerCache(usuarios, id);
}

function definirEu(usuario) {
  eu = usuario;
  guardar(usuarios, usuario._id, usuario);
}

function meuId() {
  return eu ? eu._id : null;
}

function aplicarPronto(dadosProntos) {
  for (const u of dadosProntos.users || []) guardar(usuarios, u._id, u);
  for (const s of dadosProntos.servers || []) guardar(servidores, s._id, s);
  for (const c of dadosProntos.channels || []) guardar(canais, c._id, c);
  for (const m of dadosProntos.members || []) guardar(membros, `${m._id.server}:${m._id.user}`, m);
}

function guardarServidor(servidor) {
  if (servidor && servidor._id) guardar(servidores, servidor._id, servidor);
}

function guardarCanal(canal) {
  if (canal && canal._id) guardar(canais, canal._id, canal);
}

function removerServidor(id) {
  servidores.delete(String(id));
}

function removerCanal(id) {
  canais.delete(String(id));
}

function atualizarCache(mapa, id, dadosNovos, limpar) {
  const atual = lerCache(mapa, id);
  if (!atual) return;
  const novo = { ...atual, ...(dadosNovos || {}) };
  for (const campo of limpar || []) {
    const chave = String(campo).charAt(0).toLowerCase() + String(campo).slice(1);
    delete novo[chave];
  }
  guardar(mapa, id, novo);
}

function atualizarServidor(id, dadosNovos, limpar) {
  atualizarCache(servidores, id, dadosNovos, limpar);
}

function atualizarCanal(id, dadosNovos, limpar) {
  atualizarCache(canais, id, dadosNovos, limpar);
}

function atualizarUsuario(id, dadosNovos, limpar) {
  atualizarCache(usuarios, id, dadosNovos, limpar);
}

function esquecerMembro(servidorId, usuarioId) {
  membros.delete(`${servidorId}:${usuarioId}`);
}

function urlAvatar(usuario, membro) {
  const arquivos = api.urlDosArquivos();
  const avatar = (membro && membro.avatar) || (usuario && usuario.avatar);
  if (avatar && arquivos) return `${arquivos}/avatars/${avatar._id}`;
  return usuario ? `${api.urlBase()}/users/${usuario._id}/default_avatar` : null;
}

function urlIconeServidor(servidor) {
  const arquivos = api.urlDosArquivos();
  return servidor && servidor.icon && arquivos ? `${arquivos}/icons/${servidor.icon._id}` : null;
}

function tempoDoUlid(id) {
  const texto = String(id || '').slice(0, 10).toUpperCase();
  let total = 0;
  for (const letra of texto) {
    const valor = ALFABETO_ULID.indexOf(letra);
    if (valor < 0) return undefined;
    total = total * 32 + valor;
  }
  return total;
}

function ehUlid(valor) {
  return typeof valor === 'string' && ULID.test(valor);
}

module.exports = {
  obterUsuario,
  obterCanal,
  obterServidor,
  obterMembro,
  servidorEmCache,
  usuarioEmCache,
  definirEu,
  meuId,
  aplicarPronto,
  guardarServidor,
  guardarCanal,
  removerServidor,
  removerCanal,
  atualizarServidor,
  atualizarCanal,
  atualizarUsuario,
  esquecerMembro,
  urlAvatar,
  urlIconeServidor,
  tempoDoUlid,
  ehUlid
};
