const { MODO_ENVIO } = require('../../config');
const { log, errMsg } = require('../../util/logger');
const { ehRateLimit, marcarEnvio } = require('../../util/ratelimit');
const api = require('./api');
const dados = require('./dados');
const fila = require('./fila');
const { criarMensagemCompat, criarUsuarioCompat, enviarComArquivos } = require('./compat');
const { CONTEUDO_MAX, limitar, limparTexto, corHex } = require('./texto');

const NOME_MASCARA_MAX = 32;
const TITULO_EMBED_MAX = 100;
const MAX_ANEXOS = 5;
const MARCADOR_MASCARA = 'masquerade';

function nomeDaMascara(info, rotulo) {
  const prefixo = rotulo ? `[${rotulo}] ` : '';
  const tag = info.discriminator !== undefined && info.discriminator !== null && String(info.discriminator) !== '0'
    ? `#${info.discriminator}`
    : '';
  const sufixo = ` (@${info.username}${tag})`;
  const espaco = NOME_MASCARA_MAX - prefixo.length - sufixo.length;
  if (espaco < 2) return `${prefixo}${info.nickname}`.slice(0, NOME_MASCARA_MAX) || 'Global';
  const apelido = String(info.nickname);
  const cortado = apelido.length > espaco ? `${apelido.slice(0, espaco - 1)}…` : apelido;
  return `${prefixo}${cortado}${sufixo}`;
}

function escaparItalico(texto) {
  return String(texto).replace(/[\\*_]/g, '\\$&');
}

function rodapeDe(info) {
  const partes = [];
  if (!info.ocultarServidor) partes.push(escaparItalico(info.nomeServidor));
  if (!info.ocultarPerfil && info.perfilUrl) partes.push(`[Ver perfil](<${info.perfilUrl}>)`);
  return partes.length ? `*${partes.join(' · ')}*` : '';
}

function citacao(previaReply, nomeReply) {
  if (!previaReply) return '';
  return `> **${nomeReply || 'Alguém'}**: ${previaReply}`;
}

function textoComRodape(info, conteudo, links, extras = []) {
  const rodape = rodapeDe(info);
  const miolo = [...extras, conteudo || '', ...links].filter(Boolean).join('\n');
  const limite = CONTEUDO_MAX - rodape.length - 1;
  const corpo = miolo.length > limite ? `${miolo.slice(0, limite - 1)}…` : miolo;
  return [corpo, rodape].filter(Boolean).join('\n');
}

function embedDe(info, conteudo, links, rotulo, extras = []) {
  const titulo = rotulo ? `[${rotulo}] ${info.authorText}` : info.authorText;
  const rodape = info.ocultarServidor ? '' : `*${escaparItalico(info.nomeServidor)}*`;
  const descricao = [...extras, conteudo || '', ...links, rodape].filter(Boolean).join('\n');
  const embed = { title: limitar(titulo, TITULO_EMBED_MAX) };
  if (descricao) embed.description = limitar(descricao, CONTEUDO_MAX);
  if (info.avatarUrl) embed.icon_url = info.avatarUrl;
  if (!info.ocultarPerfil && info.perfilUrl) embed.url = info.perfilUrl;
  const cor = corHex(info.corEmbed);
  if (cor) embed.colour = cor;
  return embed;
}

function criarPreparo({ message, info, obterAnexos, conteudo, rotulo }) {
  return { message, info, anexos: obterAnexos, conteudo, rotulo };
}

async function subirAnexos(anexos) {
  const ids = [];
  const links = [...anexos.links];
  for (const arquivo of anexos.arquivos.slice(0, MAX_ANEXOS)) {
    try {
      ids.push(await api.enviarArquivo(arquivo.data, arquivo.name || arquivo.filename || 'arquivo'));
    } catch (e) {
      log.warn('STOAT', `Não consegui enviar o anexo ${arquivo.name}: ${errMsg(e)}`);
    }
  }
  return { ids, links };
}

function variacoes({ modo, info, conteudo, rotulo, links, ids, mencao, alvoReply, previaReply, nomeReply }) {
  const lista = [];
  const comAnexos = (corpo) => (ids.length ? { ...corpo, attachments: ids } : corpo);
  const replies = alvoReply ? [{ id: alvoReply.msgId, mention: false }] : null;
  const cabecalhoMencao = mencao ? [mencao] : [];
  const citar = citacao(previaReply, nomeReply);
  const extrasNativo = cabecalhoMencao;
  const extrasCitado = [...cabecalhoMencao, ...(citar ? [citar] : [])];

  const corpoMascara = (extras, comResposta) => comAnexos({
    content: textoComRodape(info, conteudo, links, extras),
    masquerade: { name: nomeDaMascara(info, rotulo), ...(info.avatarUrl ? { avatar: info.avatarUrl } : {}) },
    ...(comResposta && replies ? { replies } : {})
  });

  const corpoEmbed = (extras, comResposta) => comAnexos({
    ...(mencao ? { content: mencao } : {}),
    embeds: [embedDe(info, conteudo, links, rotulo, extras.filter((e) => e !== mencao))],
    ...(comResposta && replies ? { replies } : {})
  });

  const corpoSimples = () => comAnexos({
    content: limitar(
      limparTexto([...extrasCitado, `**${info.authorText}**`, conteudo || '', ...links].filter(Boolean).join('\n')),
      CONTEUDO_MAX
    )
  });

  const principal = modo === 'webhook' ? corpoMascara : corpoEmbed;
  const marca = modo === 'webhook';

  lista.push({ corpo: principal(replies ? extrasNativo : extrasCitado, true), comReply: Boolean(replies), mascara: marca });
  if (replies) lista.push({ corpo: principal(extrasCitado, false), comReply: false, mascara: marca });
  if (modo === 'webhook') {
    lista.push({ corpo: corpoEmbed(extrasCitado, false), comReply: false, mascara: false });
  }
  lista.push({ corpo: corpoSimples(), comReply: false, mascara: false });
  return lista;
}

async function enviarComFallbacks(canalId, lista) {
  let ultimo;
  for (const variacao of lista) {
    try {
      const enviada = await api.enviarMensagem(canalId, variacao.corpo);
      return { enviada, variacao };
    } catch (e) {
      if (ehRateLimit(e)) throw e;
      ultimo = e;
      log.warn('STOAT', `Envio no canal ${canalId} falhou, tentando formato mais simples: ${errMsg(e)}`);
    }
  }
  throw ultimo;
}

async function entregar(destino, entrega) {
  const { preparo, mencao, alvoReply, previaReply, nomeReply } = entrega;
  const modo = (destino.modoEnvio || MODO_ENVIO) === 'webhook' ? 'webhook' : 'embed';
  marcarEnvio(destino.canalId);

  const anexos = await preparo.anexos();
  const { ids, links } = await subirAnexos(anexos);
  const lista = variacoes({
    modo,
    info: preparo.info,
    conteudo: preparo.conteudo,
    rotulo: preparo.rotulo,
    links,
    ids,
    mencao,
    alvoReply,
    previaReply,
    nomeReply
  });

  const { enviada, variacao } = await enviarComFallbacks(destino.canalId, lista);
  if (!enviada || !enviada._id) throw new Error('Stoat não retornou a mensagem criada');

  return {
    guildId: destino.guildId,
    canalId: destino.canalId,
    msgId: enviada._id,
    comReply: variacao.comReply,
    ...(variacao.mascara ? { webhookId: MARCADOR_MASCARA } : {})
  };
}

function montarEdicao(message, info, opcoes = {}) {
  const conteudo = opcoes.conteudo === undefined ? message.content : opcoes.conteudo;
  return {
    corpoTexto: textoComRodape(info, conteudo, []),
    embeds: [embedDe(info, conteudo, [], opcoes.rotulo)]
  };
}

async function editarCopia(copia, edicao) {
  const corpo = copia.webhookId ? { content: edicao.corpoTexto } : { embeds: edicao.embeds };
  await api.editarMensagem(copia.canalId, copia.msgId, corpo);
  return 'editada';
}

async function apagarCopia(copia) {
  try {
    await api.apagarMensagem(copia.canalId, copia.msgId);
    return 'apagada';
  } catch (e) {
    if (e && e.status === 404) return 'ausente';
    throw e;
  }
}

async function buscarMensagem(canalId, msgId) {
  return criarMensagemCompat(await api.obterMensagemApi(String(canalId), String(msgId)));
}

function buscarUsuario(userId) {
  return criarUsuarioCompat(String(userId));
}

function nomeServidor(guildId) {
  const servidor = dados.servidorEmCache(String(guildId));
  return servidor && servidor.name ? servidor.name : null;
}

function enviarAnuncio(canalId, _anuncio, embed) {
  return enviarComArquivos(canalId, { embeds: [embed] });
}

function enviarAviso(canalId, texto) {
  return enviarComArquivos(canalId, { content: texto });
}

module.exports = {
  nome: 'stoat',
  enfileirar: fila.enfileirar,
  criarPreparo,
  entregar,
  montarEdicao,
  editarCopia,
  apagarCopia,
  buscarMensagem,
  buscarUsuario,
  nomeServidor,
  enviarAnuncio,
  enviarAviso
};
