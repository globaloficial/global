const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/falsos');

H.instalarApi(H.criarApi());

const api = require('../src/plataformas/stoat/api');
const dados = require('../src/plataformas/stoat/dados');
const adaptador = require('../src/plataformas/stoat/adaptador');
const { criarMensagemCompat, emojiDaReacao } = require('../src/plataformas/stoat/compat');
const { aoEvento, comandoDisponivel } = require('../src/plataformas/stoat/eventos');
const { corpoDoTexto, embedsDoTexto } = require('../src/plataformas/stoat/texto');
const { registrarPlataforma } = require('../src/plataformas');
const { converterConteudo } = require('../src/util/conversao');
const Guild = require('../src/models/Guild');

const ID_BOT = '01HXB00000000000000000000A';
const ID_USUARIO = '01HXA00000000000000000000B';
const ID_CANAL = '01HXC00000000000000000000C';
const ID_SERVIDOR = '01HXD00000000000000000000D';

function resposta(status, corpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)),
    json: async () => corpo
  };
}

function instalarFetch(manipulador) {
  const chamadas = [];
  global.fetch = async (url, opcoes = {}) => {
    const corpo = opcoes.body && typeof opcoes.body === 'string' ? JSON.parse(opcoes.body) : null;
    const chamada = { url: String(url), metodo: opcoes.method || 'GET', corpo, headers: opcoes.headers || {} };
    chamadas.push(chamada);
    return manipulador(chamada);
  };
  return chamadas;
}

function preparoDe(extra = {}) {
  const info = {
    nickname: 'Fulano',
    discriminator: '0001',
    username: 'fulano',
    authorText: 'Fulano (@fulano)',
    corEmbed: 0x0b0b0b,
    avatarUrl: 'https://img/a.png',
    perfilUrl: 'https://perfil/1',
    nomeServidor: 'Servidor X',
    ocultarServidor: false,
    ocultarPerfil: false,
    ...extra
  };
  return {
    message: {},
    info,
    conteudo: 'olá mundo',
    rotulo: 'Discord',
    anexos: async () => ({ arquivos: [], links: [] })
  };
}

const destino = { guildId: ID_SERVIDOR, canalId: ID_CANAL };

test.beforeEach(() => {
  api.definirToken('token');
});

test('modo webhook envia com masquerade, nome limitado a 32 e rótulo da plataforma', async () => {
  const chamadas = instalarFetch(() => resposta(200, { _id: 'M1' }));
  const r = await adaptador.entregar({ ...destino, modoEnvio: 'webhook' }, {
    preparo: preparoDe({ nickname: 'Um nome bem comprido que passa do limite' }),
    mencao: null,
    alvoReply: null
  });

  assert.equal(r.msgId, 'M1');
  assert.equal(r.webhookId, 'masquerade');
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].metodo, 'POST');
  assert.match(chamadas[0].url, /\/channels\/01HXC00000000000000000000C\/messages$/);
  assert.equal(chamadas[0].headers['X-Bot-Token'], 'token');
  assert.ok(chamadas[0].corpo.masquerade.name.length <= 32);
  assert.match(chamadas[0].corpo.masquerade.name, /^\[Discord\] .+ \(@fulano#0001\)$/);
  assert.equal(chamadas[0].corpo.masquerade.avatar, 'https://img/a.png');
  assert.match(chamadas[0].corpo.content, /^olá mundo\n\*Servidor X · \[Ver perfil\]\(<https:\/\/perfil\/1>\)\*$/);
});

test('modo embed envia embed com título, cor e descrição', async () => {
  const chamadas = instalarFetch(() => resposta(200, { _id: 'M2' }));
  const r = await adaptador.entregar({ ...destino, modoEnvio: 'embed' }, { preparo: preparoDe(), mencao: null, alvoReply: null });

  assert.equal(r.webhookId, undefined);
  const embed = chamadas[0].corpo.embeds[0];
  assert.equal(embed.title, '[Discord] Fulano (@fulano)');
  assert.equal(embed.colour, '#0b0b0b');
  assert.match(embed.description, /^olá mundo\n\*Servidor X\*$/);
  assert.equal(embed.icon_url, 'https://img/a.png');
});

test('reply nativo usa replies e cai para citação quando o alvo falha', async () => {
  let n = 0;
  const chamadas = instalarFetch(() => (++n === 1 ? resposta(404, { type: 'NotFound' }) : resposta(200, { _id: 'M3' })));
  const r = await adaptador.entregar({ ...destino, modoEnvio: 'webhook' }, {
    preparo: preparoDe(),
    mencao: null,
    alvoReply: { msgId: 'ALVO' },
    previaReply: 'oi tudo bem',
    nomeReply: 'Beltrano'
  });

  assert.deepEqual(chamadas[0].corpo.replies, [{ id: 'ALVO', mention: false }]);
  assert.equal(chamadas[1].corpo.replies, undefined);
  assert.match(chamadas[1].corpo.content, /^> \*\*Beltrano\*\*: oi tudo bem\nolá mundo/);
  assert.equal(r.comReply, false);
});

test('429 é propagado com retryAfter em segundos para a fila', async () => {
  instalarFetch(() => resposta(429, { retry_after: 1500 }));
  await assert.rejects(
    adaptador.entregar({ ...destino, modoEnvio: 'webhook' }, { preparo: preparoDe(), mencao: null, alvoReply: null }),
    (e) => e.name === 'RateLimitError' && e.retryAfter === 1.5
  );
});

test('editar e apagar cópias', async () => {
  const chamadas = instalarFetch((c) => (c.metodo === 'DELETE' && /MSG404/.test(c.url) ? resposta(404, { type: 'NotFound' }) : resposta(204)));
  const edicao = adaptador.montarEdicao({ content: 'novo' }, preparoDe().info, { conteudo: 'novo', rotulo: null });

  assert.equal(await adaptador.editarCopia({ canalId: ID_CANAL, msgId: 'M1', webhookId: 'masquerade' }, edicao), 'editada');
  assert.equal(chamadas[0].metodo, 'PATCH');
  assert.match(chamadas[0].corpo.content, /^novo/);

  await adaptador.editarCopia({ canalId: ID_CANAL, msgId: 'M2', webhookId: null }, edicao);
  assert.equal(chamadas[1].corpo.embeds[0].description.startsWith('novo'), true);

  assert.equal(await adaptador.apagarCopia({ canalId: ID_CANAL, msgId: 'M1' }), 'apagada');
  assert.equal(await adaptador.apagarCopia({ canalId: ID_CANAL, msgId: 'MSG404' }), 'ausente');
});

test('conversão de menções e emojis do Stoat para outras plataformas', () => {
  const texto = `oi <@${ID_USUARIO}> veja <#${ID_CANAL}> :01HXF00000000000000000000F: e @everyone`;
  assert.equal(converterConteudo(texto, 'stoat', 'fluxer'), 'oi @usuário veja #canal :emoji: e @​everyone');
});

test('texto de comandos troca emojis pelos do Stoat e embeds viram embeds do Stoat', () => {
  const entrada = {
    content: '# <:checkboxcirclefill:1562606683371339777> Título <:naoexiste:1>\n-# nota',
    embeds: [{ toJSON: () => ({ title: '<:heart2fill:1> T', description: 'D', color: 0x0330ef, fields: [{ name: 'N', value: 'V' }] }) }]
  };
  assert.equal(corpoDoTexto(entrada), '# :01M82GD5929PMVM83NJ9M9JSBZ: Título\n_nota_');
  assert.deepEqual(embedsDoTexto(entrada), [{
    description: '### :01M82G07X7NGDDWEXS1RVP2X8A: T\n\nD\n\n**N**\nV',
    colour: '#0330ef'
  }]);
});

test('reações: unicode passa, emojis de feedback viram unicode, personalizados são ignorados', () => {
  assert.equal(emojiDaReacao('❤️'), '❤️');
  assert.equal(emojiDaReacao('<:closecirclefill:1562606683371339786>'), '❌');
  assert.equal(emojiDaReacao('<:heart:1>'), null);
});

test('comandos liberados no Stoat', () => {
  assert.equal(comandoDisponivel('g.conectar'), true);
  assert.equal(comandoDisponivel('g.verreação'), true);
  assert.equal(comandoDisponivel('g.perfil'), true);
  assert.equal(comandoDisponivel('g.ban'), false);
  assert.equal(comandoDisponivel('conectar'), false);
});

test('mensagem do Stoat é retransmitida para o outro destino e ignora bots e mascaradas', async () => {
  const chamadas = instalarFetch((c) => {
    if (c.metodo === 'POST') return resposta(200, { _id: `COPIA${chamadas.length}` });
    return resposta(404, {});
  });

  dados.definirEu({ _id: ID_BOT, username: 'Global', bot: { owner: 'x' } });
  dados.aplicarPronto({
    users: [
      { _id: ID_USUARIO, username: 'fulano', discriminator: '0001', display_name: 'Fulano' },
      { _id: ID_BOT, username: 'Global', bot: { owner: 'x' } }
    ],
    servers: [{ _id: ID_SERVIDOR, name: 'Servidor Stoat', owner: ID_USUARIO, default_permissions: 0, roles: {} }],
    channels: [{ _id: ID_CANAL, channel_type: 'TextChannel', server: ID_SERVIDOR, nsfw: false }],
    members: []
  });
  registrarPlataforma(adaptador);

  H.popularDestinos(2);
  const guilds = H.dados.get('Guild');
  guilds[0] = { guildId: ID_SERVIDOR, canalId: ID_CANAL, plataforma: 'stoat', pausado: false, filtrarPalavroes: false, filtrarLinks: false, mostrarIcone: false, cor: null };
  await Guild.updateOne({ guildId: 'g2' }, { $set: { plataforma: 'stoat', canalId: '01HXE00000000000000000000E' } });

  const raw = { _id: 'ORIGEM1', channel: ID_CANAL, author: ID_USUARIO, content: 'teste global', mentions: [], attachments: [] };
  const compat = await criarMensagemCompat(raw);
  assert.equal(compat.plataforma, 'stoat');
  assert.equal(compat.guildId, ID_SERVIDOR);
  assert.equal(compat.author.displayName, 'Fulano');
  assert.equal(compat.channel.nsfw, false);

  await aoEvento({ type: 'Message', ...raw });
  const envios = chamadas.filter((c) => c.metodo === 'POST');
  assert.equal(envios.length, 1);
  assert.match(envios[0].url, /01HXE00000000000000000000E\/messages$/);

  const antes = chamadas.length;
  await aoEvento({ type: 'Message', ...raw, _id: 'ORIGEM2', author: ID_BOT });
  await aoEvento({ type: 'Message', ...raw, _id: 'ORIGEM3', masquerade: { name: 'x' } });
  assert.equal(chamadas.length, antes);
});

test('servidor com ocultarInfoRecebida recebe a mensagem sem nome do servidor e sem ver perfil', async () => {
  const chamadas = instalarFetch((c) => (c.metodo === 'POST' ? resposta(200, { _id: `LIMPA${chamadas.length}` }) : resposta(404, {})));
  registrarPlataforma(adaptador);
  const { retransmitirMensagemGlobal } = require('../src/services/chat/retransmissao');

  H.popularDestinos(3);
  await Guild.updateOne({ guildId: 'g2' }, { $set: { plataforma: 'stoat', canalId: '01HXE00000000000000000000E', ocultarInfoRecebida: true, modoEnvio: 'webhook' } });
  await Guild.updateOne({ guildId: 'g3' }, { $set: { plataforma: 'stoat', canalId: '01HXG00000000000000000000G', modoEnvio: 'webhook' } });

  await retransmitirMensagemGlobal({ ...H.mensagemDe({ guildIdx: 1, conteudo: 'oi pessoal' }), plataforma: 'fluxer' });

  const limpa = chamadas.find((c) => c.url.includes('01HXE00000000000000000000E'));
  const completa = chamadas.find((c) => c.url.includes('01HXG00000000000000000000G'));
  assert.equal(limpa.corpo.content, 'oi pessoal');
  assert.match(completa.corpo.content, /^oi pessoal\n\*Servidor g1 · \[Ver perfil\]/);
});
