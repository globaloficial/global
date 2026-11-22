const { DONO_ID } = require('../../config');
const api = require('./api');
const dados = require('./dados');
const fila = require('./fila');
const { corpoDoTexto, embedsDoTexto } = require('./texto');

const PERMISSAO_GERENCIAR_CANAL = 1n << 0n;
const PERMISSAO_GERENCIAR_SERVIDOR = 1n << 1n;

const REGRA_ERRO = /error|close|forbid|warning/i;
const REGRA_SUCESSO = /check|success/i;
const EMOJI_UNICODE = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣)/u;

function emojiDaReacao(emoji) {
  const texto = String(emoji || '');
  if (EMOJI_UNICODE.test(texto)) return texto;
  if (REGRA_ERRO.test(texto)) return '❌';
  if (REGRA_SUCESSO.test(texto)) return '✅';
  return null;
}

function autorCompat(usuario, membro, mascara) {
  const apelido = (membro && membro.nickname) || usuario.display_name || usuario.username;
  const nome = (mascara && mascara.name) || apelido;
  return {
    id: usuario._id,
    username: (mascara && mascara.name) || usuario.username,
    discriminator: usuario.discriminator,
    displayName: nome,
    bot: Boolean(usuario.bot),
    globalName: (mascara && mascara.name) || usuario.display_name || null,
    createdTimestamp: dados.tempoDoUlid(usuario._id),
    toString: () => `<@${usuario._id}>`,
    displayAvatarURL: () => (mascara && mascara.avatar) || dados.urlAvatar(usuario, membro)
  };
}

function guildCompat(servidor) {
  if (!servidor) return null;
  return {
    id: servidor._id,
    name: servidor.name,
    ownerId: servidor.owner,
    nsfw: Boolean(servidor.nsfw),
    iconURL: () => dados.urlIconeServidor(servidor)
  };
}

function mapaDeAnexos(arquivos) {
  const base = api.urlDosArquivos();
  const mapa = new Map();
  for (const a of arquivos || []) {
    mapa.set(a._id, {
      id: a._id,
      filename: a.filename,
      size: a.size,
      contentType: a.content_type,
      url: base ? `${base}/${a.tag || 'attachments'}/${a._id}/${encodeURIComponent(a.filename)}` : null
    });
  }
  mapa['first'] = () => mapa.values().next().value;
  return mapa;
}

function mapaDeMencoes(ids) {
  const mapa = new Map();
  for (const id of ids || []) mapa.set(id, { id, bot: false });
  mapa['first'] = () => mapa.values().next().value;
  return { users: mapa };
}

async function permissoesDoMembro(servidor, usuarioId) {
  if (!servidor) return 0n;
  if (servidor.owner === usuarioId) return ~0n;
  const membro = await dados.obterMembro(servidor._id, usuarioId);
  let permissoes = BigInt(servidor.default_permissions || 0);
  const cargos = ((membro && membro.roles) || [])
    .map((id) => (servidor.roles || {})[id])
    .filter(Boolean)
    .sort((a, b) => (b.rank || 0) - (a.rank || 0));
  for (const cargo of cargos) {
    const regra = cargo.permissions || {};
    permissoes |= BigInt(regra.a || 0);
    permissoes &= ~BigInt(regra.d || 0);
  }
  return permissoes;
}

async function podeGerenciar(servidor, usuarioId) {
  if (String(usuarioId) === DONO_ID) return true;
  const permissoes = await permissoesDoMembro(servidor, usuarioId);
  return (permissoes & (PERMISSAO_GERENCIAR_CANAL | PERMISSAO_GERENCIAR_SERVIDOR)) !== 0n;
}

async function enviarComArquivos(canalId, conteudo, replies) {
  const opcoes = typeof conteudo === 'string' ? { content: conteudo } : { ...(conteudo || {}) };
  const corpo = {};
  const texto = corpoDoTexto(opcoes);
  if (texto) corpo.content = texto;
  const embeds = embedsDoTexto(opcoes);
  if (embeds.length) corpo.embeds = embeds;
  if (replies) corpo.replies = replies;

  if (Array.isArray(opcoes.files) && opcoes.files.length) {
    const ids = [];
    for (const arquivo of opcoes.files.slice(0, 5)) {
      if (!arquivo || !arquivo.data) continue;
      ids.push(await api.enviarArquivo(arquivo.data, arquivo.name || 'arquivo.png'));
    }
    if (ids.length) corpo.attachments = ids;
  }

  if (!corpo.content && !corpo.attachments && !corpo.embeds) corpo.content = '​';
  return api.enviarMensagem(canalId, corpo);
}

async function criarMensagemCompat(raw) {
  const canal = await dados.obterCanal(raw.channel);
  const servidor = canal && canal.server ? await dados.obterServidor(canal.server) : null;
  const usuario = await dados.obterUsuario(raw.author);
  const membro = servidor ? await dados.obterMembro(servidor._id, raw.author) : null;
  const guild = guildCompat(servidor);

  const enviar = (conteudo, replies) => enviarComArquivos(raw.channel, conteudo, replies);

  return {
    plataforma: 'stoat',
    raw,
    id: raw._id,
    content: raw.content || '',
    contentBruto: raw.content || '',
    channelId: raw.channel,
    guildId: servidor ? servidor._id : null,
    guild,
    webhookId: null,
    type: 0,
    attachments: mapaDeAnexos(raw.attachments),
    stickers: [],
    messageReference: raw.replies && raw.replies.length ? { messageId: raw.replies[0] } : null,
    mentions: mapaDeMencoes(raw.mentions),
    author: autorCompat(usuario, membro, raw.masquerade),
    member: membro ? { displayName: membro.nickname || null, nickname: membro.nickname || null } : null,
    channel: {
      id: raw.channel,
      guildId: servidor ? servidor._id : null,
      nsfw: Boolean(canal && canal.nsfw),
      send: (conteudo) => enviar(conteudo)
    },
    reply: (conteudo) => enviar(conteudo, [{ id: raw._id, mention: false }]),
    react: async (emoji) => {
      const unicode = emojiDaReacao(emoji);
      if (!unicode) return null;
      return api.reagirMensagem(raw.channel, raw._id, unicode);
    },
    delete: () => api.apagarMensagem(raw.channel, raw._id),
    podeGerenciarCanais: () => podeGerenciar(servidor, raw.author),
    bloqueioAtivo: () => fila.bloqueioAtivo()
  };
}

async function criarUsuarioCompat(id) {
  const usuario = await dados.obterUsuario(id);
  return autorCompat(usuario, null, null);
}

module.exports = {
  criarMensagemCompat,
  criarUsuarioCompat,
  autorCompat,
  guildCompat,
  podeGerenciar,
  permissoesDoMembro,
  emojiDaReacao,
  enviarComArquivos
};
