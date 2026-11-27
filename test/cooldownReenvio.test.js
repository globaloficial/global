const test = require('node:test');
const assert = require('node:assert/strict');
require('./harness/falsos');
const { marcarBloqueada, tratarReacaoBloqueada, tipoDoEmoji, previaDaMensagem } = require('../src/services/cooldownReenvio');
const { espelharReacao } = require('../src/services/reacoes');

function mensagem(id, plataforma = 'fluxer', autor = 'u1') {
  const registro = { reagidas: [], removidas: [], respostas: [] };
  return {
    registro,
    id,
    plataforma,
    content: 'olá [mundo] @everyone',
    guildId: 'g1',
    channel: { id: 'c1' },
    author: { id: autor },
    react: async (e) => { registro.reagidas.push(e); },
    desreagir: async (e) => { registro.removidas.push(e); },
    reply: async (t) => { registro.respostas.push(t); }
  };
}

test('reconhece emojis de erro e reenvio nas três plataformas', () => {
  assert.equal(tipoDoEmoji({ id: '1562606683371339786' }), 'erro');
  assert.equal(tipoDoEmoji({ id: '1571357854995189881' }), 'erro');
  assert.equal(tipoDoEmoji('01M82GCPKH9VGR4CC45JP6CFCX'), 'erro');
  assert.equal(tipoDoEmoji({ id: '1576011387614793728' }), 'reenviar');
  assert.equal(tipoDoEmoji({ id: '1576011945847292036' }), 'reenviar');
  assert.equal(tipoDoEmoji('01M8FMAMJ2MDY49SS1PKZTEPCA'), 'reenviar');
  assert.equal(tipoDoEmoji({ id: null, name: '❤️' }), null);
});

test('prévia limpa colchetes e menções', () => {
  const p = previaDaMensagem({ content: 'olá [mundo] @everyone' });
  assert.ok(!p.includes('[') && !p.includes('@everyone'));
  assert.ok(p.endsWith('...'));
});

test('bloqueio reage com erro e reenvio; Stoat usa ULIDs', async () => {
  const f = mensagem('m1');
  await marcarBloqueada(f, async () => {});
  assert.deepEqual(f.registro.reagidas, ['<:closecirclefill:1562606683371339786>', '<:restartfill:1576011387614793728>']);
  const s = mensagem('m2', 'stoat');
  await marcarBloqueada(s, async () => {});
  assert.deepEqual(s.registro.reagidas, [':01M82GCPKH9VGR4CC45JP6CFCX:', ':01M8FMAMJ2MDY49SS1PKZTEPCA:']);
});

test('aviso sai uma vez por pessoa a cada 30 minutos', async () => {
  const m = mensagem('m3');
  await marcarBloqueada(m, async () => {});
  const dados = { msgId: 'm3', emoji: { id: '1562606683371339786' }, plataforma: 'fluxer' };
  assert.equal(await tratarReacaoBloqueada({ ...dados, usuarioId: 'u2' }), true);
  await tratarReacaoBloqueada({ ...dados, usuarioId: 'u2' });
  await tratarReacaoBloqueada({ ...dados, emoji: { id: '1576011387614793728' }, usuarioId: 'u2' });
  assert.equal(m.registro.respostas.length, 1);
  assert.match(m.registro.respostas[0], /Mensagem não enviada/);
  assert.match(m.registro.respostas[0], /<:restartfill:1576011387614793728>/);
  await tratarReacaoBloqueada({ ...dados, usuarioId: 'u3' });
  assert.equal(m.registro.respostas.length, 2);
});

test('só o autor reenvia; reações viram sucesso', async () => {
  let envios = 0;
  const m = mensagem('m4');
  await marcarBloqueada(m, async () => { envios++; });
  const dados = { msgId: 'm4', emoji: { id: '1576011387614793728' }, plataforma: 'fluxer' };
  await tratarReacaoBloqueada({ ...dados, usuarioId: 'outro' });
  assert.equal(envios, 0);
  await tratarReacaoBloqueada({ ...dados, usuarioId: 'u1' });
  assert.equal(envios, 1);
  assert.deepEqual(m.registro.removidas, ['<:closecirclefill:1562606683371339786>', '<:restartfill:1576011387614793728>']);
  assert.equal(m.registro.reagidas.at(-1), '<:checkboxcirclefill:1562606683371339777>');
  assert.equal(await tratarReacaoBloqueada({ ...dados, usuarioId: 'u1' }), false);
  assert.equal(envios, 1);
});

test('falha no reenvio mantém a mensagem pendente', async () => {
  let tentativas = 0;
  const m = mensagem('m5');
  await marcarBloqueada(m, async () => { tentativas++; if (tentativas === 1) throw new Error('x'); });
  const dados = { msgId: 'm5', emoji: { id: '1576011387614793728' }, plataforma: 'fluxer', usuarioId: 'u1' };
  await tratarReacaoBloqueada(dados);
  await tratarReacaoBloqueada(dados);
  assert.equal(tentativas, 2);
});

test('espelharReacao encaminha para o fluxo e ignora bots', async () => {
  const m = mensagem('m6', 'stoat');
  await marcarBloqueada(m, async () => {});
  await espelharReacao({ msgId: 'm6', emoji: null, emojiId: '01M82GCPKH9VGR4CC45JP6CFCX', usuarioId: 'u9', plataforma: 'stoat', bot: false });
  assert.equal(m.registro.respostas.length, 1);
  await espelharReacao({ msgId: 'm6', emoji: null, emojiId: '01M82GCPKH9VGR4CC45JP6CFCX', usuarioId: 'u8', plataforma: 'stoat', bot: true });
  assert.equal(m.registro.respostas.length, 1);
});
