const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/falsos');

H.instalarApi(H.criarApi());

const pontes = require('../src/services/pontes');
const Ponte = require('../src/models/Ponte');
const conectar = require('../src/commands/conexao/conectar');
const pausar = require('../src/commands/conexao/pausar');
const retomar = require('../src/commands/conexao/retomar');
const desconectar = require('../src/commands/conexao/desconectar');
const ponte = require('../src/commands/conexao/ponte');

function ctx(guildId, canalId, podeGerenciar = true) {
  const respostas = [];
  return {
    respostas,
    plataforma: 'fluxer',
    guildId,
    guild: { id: guildId, name: `Servidor ${guildId}` },
    channel: { id: canalId, guildId, send: async () => ({}) },
    author: { id: 'u-dono', bot: false },
    podeGerenciarCanais: async () => podeGerenciar,
    reply: async (t) => { respostas.push(typeof t === 'string' ? t : t.content); return { id: 'r' }; }
  };
}

async function limpar() {
  await Ponte.deleteMany({});
  await pontes.recarregarPontes();
  H.popularDestinos(0);
}

test('conectar, pausar, retomar e desconectar a conexão global do canal', async () => {
  await limpar();
  const c = ctx('g1', 'c1');

  await conectar.execute(c);
  assert.match(c.respostas[0], /^# .* Conectado com sucesso/);

  await pausar.execute(c);
  assert.match(c.respostas[1], /Pausado com sucesso/);
  assert.equal(H.dados.get('Guild').find((g) => g.guildId === 'g1').pausado, true);

  await pausar.execute(c);
  assert.match(c.respostas[2], /já está pausada/);

  await retomar.execute(c);
  assert.match(c.respostas[3], /Retomado com sucesso/);

  const outroCanal = ctx('g1', 'c9');
  await pausar.execute(outroCanal);
  assert.match(outroCanal.respostas[0], /Eu vou pausar o vento\?/);

  await desconectar.execute(c);
  assert.match(c.respostas[4], /Desconectado com sucesso/);
  assert.equal(H.dados.get('Guild').find((g) => g.guildId === 'g1').canalId, null);

  await desconectar.execute(c);
  assert.match(c.respostas[5], /Eu vou desconectar o vento\?/);
});

test('pausar e desconectar valem para a conexão privada do canal', async () => {
  await limpar();
  const a = ctx('g1', 'c1');
  await ponte.execute(a, ['criar']);
  assert.match(a.respostas[0], /Ponte criada com sucesso/);
  assert.match(a.respostas[0], /Ponte Privada de Servidor g1/);

  await pausar.execute(a);
  assert.match(a.respostas[1], /Conexão Privada/);
  const [ativa] = await Ponte.find({}).lean();
  assert.equal(ativa.participantes[0].pausado, true);

  await desconectar.execute(a);
  assert.match(a.respostas[2], /Desconectado com sucesso/);
  assert.equal((await Ponte.find({}).lean()).length, 0);
});

test('canal com conexão e sem permissão são recusados', async () => {
  await limpar();
  const c = ctx('g1', 'c1');
  await conectar.execute(c);
  await conectar.execute(c);
  assert.match(c.respostas[1], /já tem uma conexão ativa/);

  const semPermissao = ctx('g1', 'c1', false);
  await pausar.execute(semPermissao);
  assert.match(semPermissao.respostas[0], /Sem permissões, oh no\./);
});
