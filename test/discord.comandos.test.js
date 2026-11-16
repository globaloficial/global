const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/falsos');

H.instalarApi(H.criarApi());
H.instalarApiDiscord(H.criarApiDiscord());

const Guild = require('../src/models/Guild');
const { criarInteracaoCompat, criarMensagemCompat } = require('../src/plataformas/discord/compat');
const { definicoes } = require('../src/plataformas/discord/slash');
const { carregarComandos, tratarComando } = require('../src/handlers/commandHandler');

function interacaoFalsa({ permissoes = true, usuario = 'u-adm' } = {}) {
  const respostas = [];
  return {
    respostas,
    id: 'i1',
    channelId: 'c3',
    guildId: 'g3',
    guild: { id: 'g3', name: 'Discord g3' },
    user: { id: usuario, username: 'adm', discriminator: '0', bot: false, displayAvatarURL: () => null },
    member: null,
    memberPermissions: { has: () => permissoes },
    channel: { id: 'c3', nsfw: false, send: async () => ({ id: 'x' }) },
    deferred: true,
    replied: false,
    editReply: async (o) => { respostas.push(o); return { id: 'painel-1' }; },
    followUp: async (o) => { respostas.push(o); return { id: 'extra' }; },
    reply: async (o) => { respostas.push(o); return { id: 'painel-1' }; }
  };
}

function textoDe(resposta) {
  const partes = [];
  const percorrer = (no) => {
    if (Array.isArray(no)) return no.forEach(percorrer);
    if (!no || typeof no !== 'object') return;
    if (no.type === 10) partes.push(no.content);
    percorrer(no.components);
  };
  percorrer(resposta.components);
  return partes.join('\n');
}

test('/conectar no Discord grava a plataforma e converte emojis do Fluxer', async () => {
  H.popularDestinos(0);
  carregarComandos();
  const interacao = interacaoFalsa();
  const compat = criarInteracaoCompat(interacao, '');

  assert.equal(await tratarComando(compat, 'g.conectar', ['conexao', 'geral']), true);

  const row = H.dados.get('Guild').find((g) => g.guildId === 'g3');
  assert.equal(row.plataforma, 'discord');
  assert.equal(row.canalId, 'c3');
  assert.match(textoDe(interacao.respostas[0]), /^# <:checkboxcirclefill:\d+> Conectado com sucesso/);
  assert.match(textoDe(interacao.respostas[0]), /Conexão Global/);
});

test('sem Gerenciar Canais o comando é negado', async () => {
  H.popularDestinos(0);
  carregarComandos();
  const interacao = interacaoFalsa({ permissoes: false });
  await tratarComando(criarInteracaoCompat(interacao, ''), 'g.conectar', ['conexao', 'geral']);

  assert.equal(H.dados.get('Guild').length, 0);
  assert.match(textoDe(interacao.respostas[0]), /Gerenciar canais/);
});

test('comandos de staff e dono não passam pelo Discord', async () => {
  carregarComandos();
  const interacao = interacaoFalsa();
  assert.equal(await tratarComando(criarInteracaoCompat(interacao, ''), 'g.ban 1', ['conexao', 'geral']), false);
});

test('/config no Discord abre o painel com botões e reflete o modo de envio', async () => {
  H.popularDestinos(0);
  carregarComandos();
  await Guild.findOneAndUpdate({ guildId: 'g3' }, { canalId: 'c3', plataforma: 'discord', modoEnvio: 'webhook' }, { upsert: true });

  const interacao = interacaoFalsa();
  await tratarComando(criarInteracaoCompat(interacao, ''), 'g.config', ['conexao', 'geral']);
  const resposta = interacao.respostas[0];
  assert.equal(resposta.flags, 1 << 15);
  assert.match(textoDe(resposta), /Configurações do Servidor/);
  assert.match(textoDe(resposta), /Webhook/);
  assert.doesNotMatch(textoDe(resposta), /Reaja/);
  const ids = JSON.stringify(resposta.components).match(/painel\|config\|\w+\|u-adm/g);
  assert.equal(ids.length, 3);
});

test('slash registra só comandos permitidos e a mensagem compat mantém permissão e conteúdo limpo', async () => {
  carregarComandos();
  const nomes = definicoes().map((d) => d.name).sort();
  assert.deepEqual(nomes, ['ajuda', 'automod', 'botinfo', 'conectar', 'config', 'desconectar', 'destacar', 'pausar', 'ping', 'ponte', 'retomar']);

  const bruta = {
    id: 'm1', content: 'oi <@1>', cleanContent: 'oi @fulano', channelId: 'c3', guildId: 'g3',
    guild: { id: 'g3', name: 'G' }, webhookId: null, type: 0, attachments: new Map(), stickers: new Map(),
    reference: { messageId: 'm0' }, mentions: { users: new Map() },
    member: { displayName: 'Fulano', permissions: { has: () => true }, displayAvatarURL: () => 'av' },
    author: { id: 'u1', username: 'fulano', discriminator: '0', bot: false, globalName: 'F', displayAvatarURL: () => 'av' },
    channel: { nsfw: false, send: async () => ({}) }
  };
  const compat = criarMensagemCompat(bruta);
  assert.equal(compat.content, 'oi @fulano');
  assert.equal(compat.messageReference.messageId, 'm0');
  assert.equal(compat.author.displayName, 'Fulano');
  assert.equal(`${compat.author}`, '<@u1>');
  assert.equal(await compat.podeGerenciarCanais(), true);
});
