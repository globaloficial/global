const { randomUUID } = require('node:crypto');

const API_PADRAO = 'https://api.stoat.chat';
const TEMPO_MAX_MS = 20_000;
const JANELA_CANAL_MS = 10_000;
const MAX_POR_JANELA = 9;

let token = null;
let base = (process.env.STOAT_API_URL || API_PADRAO).replace(/\/+$/, '');
let configuracao = null;

const enviosPorCanal = new Map();

class ErroStoat extends Error {
  constructor(status, corpo, retryAfterMs) {
    const tipo = corpo && corpo.type ? corpo.type : `HTTP ${status}`;
    super(`Stoat ${status}: ${tipo}`);
    this.name = status === 429 ? 'RateLimitError' : 'ErroStoat';
    this.status = status;
    this.data = corpo;
    if (retryAfterMs !== undefined) this.retryAfter = retryAfterMs / 1000;
  }
}

function definirToken(valor) {
  token = valor;
}

function definirBase(url) {
  base = String(url).replace(/\/+$/, '');
}

function urlBase() {
  return base;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respeitarJanelaDoCanal(canalId) {
  const chave = String(canalId);
  for (;;) {
    const agora = Date.now();
    const lista = (enviosPorCanal.get(chave) || []).filter((t) => agora - t < JANELA_CANAL_MS);
    if (lista.length < MAX_POR_JANELA) {
      lista.push(agora);
      enviosPorCanal.set(chave, lista);
      return;
    }
    enviosPorCanal.set(chave, lista);
    await esperar(JANELA_CANAL_MS - (agora - lista[0]) + 20);
  }
}

async function requisitar(metodo, caminho, opcoes = {}) {
  const { corpo, formulario, cabecalhos } = opcoes;
  const headers = { 'X-Bot-Token': token, ...(cabecalhos || {}) };
  let body;
  if (formulario) {
    body = formulario;
  } else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }

  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers,
    body,
    signal: AbortSignal.timeout(TEMPO_MAX_MS)
  });

  const texto = resposta.status === 204 ? '' : await resposta.text();
  let json = null;
  if (texto) {
    try {
      json = JSON.parse(texto);
    } catch (_) {
      json = null;
    }
  }

  if (!resposta.ok) {
    let espera;
    if (resposta.status === 429) {
      const doCorpo = Number(json && json.retry_after);
      const doCabecalho = Number(resposta.headers.get('x-ratelimit-reset-after'));
      espera = [doCorpo, doCabecalho].find((n) => Number.isFinite(n) && n >= 0);
      if (espera === undefined) espera = 1000;
    }
    throw new ErroStoat(resposta.status, json, espera);
  }
  return json;
}

async function obterConfiguracao(forcar = false) {
  if (configuracao && !forcar) return configuracao;
  const resposta = await fetch(`${base}/`, { signal: AbortSignal.timeout(TEMPO_MAX_MS) });
  if (!resposta.ok) throw new ErroStoat(resposta.status, null);
  configuracao = await resposta.json();
  return configuracao;
}

function urlDosArquivos() {
  const f = configuracao && configuracao.features;
  const autumn = f && f.autumn;
  const url = (autumn && autumn.url) || (f && f.autumn_url) || null;
  return url ? String(url).replace(/\/+$/, '') : null;
}

function urlDoGateway() {
  const ws = configuracao && configuracao.ws;
  return ws ? String(ws) : null;
}

const euMesmo = () => requisitar('GET', '/users/@me');

const obterUsuarioApi = (id) => requisitar('GET', `/users/${encodeURIComponent(id)}`);

const obterCanalApi = (id) => requisitar('GET', `/channels/${encodeURIComponent(id)}`);

const obterServidorApi = (id) => requisitar('GET', `/servers/${encodeURIComponent(id)}`);

const obterMembroApi = (servidorId, usuarioId) =>
  requisitar('GET', `/servers/${encodeURIComponent(servidorId)}/members/${encodeURIComponent(usuarioId)}`);

const obterMensagemApi = (canalId, msgId) =>
  requisitar('GET', `/channels/${encodeURIComponent(canalId)}/messages/${encodeURIComponent(msgId)}`);

async function enviarMensagem(canalId, corpo) {
  await respeitarJanelaDoCanal(canalId);
  return requisitar('POST', `/channels/${encodeURIComponent(canalId)}/messages`, {
    corpo,
    cabecalhos: { 'Idempotency-Key': randomUUID() }
  });
}

const editarMensagem = (canalId, msgId, corpo) =>
  requisitar('PATCH', `/channels/${encodeURIComponent(canalId)}/messages/${encodeURIComponent(msgId)}`, { corpo });

const apagarMensagem = (canalId, msgId) =>
  requisitar('DELETE', `/channels/${encodeURIComponent(canalId)}/messages/${encodeURIComponent(msgId)}`);

const reagirMensagem = (canalId, msgId, emoji) =>
  requisitar('PUT', `/channels/${encodeURIComponent(canalId)}/messages/${encodeURIComponent(msgId)}/reactions/${encodeURIComponent(emoji)}`);

async function enviarArquivo(dados, nome) {
  const autumn = urlDosArquivos();
  if (!autumn) throw new Error('Servidor de arquivos do Stoat indisponível');
  const formulario = new FormData();
  formulario.append('file', new Blob([dados]), nome);
  const resposta = await fetch(`${autumn}/attachments`, {
    method: 'POST',
    headers: { 'X-Bot-Token': token },
    body: formulario,
    signal: AbortSignal.timeout(TEMPO_MAX_MS * 2)
  });
  const json = Object(await resposta.json().catch(() => null));
  if (!resposta.ok || !json['id']) throw new ErroStoat(resposta.status, json);
  return String(json['id']);
}

module.exports = {
  ErroStoat,
  definirToken,
  definirBase,
  urlBase,
  requisitar,
  obterConfiguracao,
  urlDosArquivos,
  urlDoGateway,
  euMesmo,
  obterUsuarioApi,
  obterCanalApi,
  obterServidorApi,
  obterMembroApi,
  obterMensagemApi,
  enviarMensagem,
  editarMensagem,
  apagarMensagem,
  reagirMensagem,
  enviarArquivo
};
