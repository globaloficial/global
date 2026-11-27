const test = require('node:test');
const assert = require('node:assert/strict');
require('./harness/falsos');
const { aguardarEntregas, ATRASADO } = require('../src/services/chat/retransmissao');

const espera = (ms, valor) => new Promise((resolve) => { setTimeout(() => resolve(valor), ms); });

test('plataforma travada não segura as outras: vira atrasada depois da graça', async () => {
  const entregas = [espera(10, 'a'), espera(20, 'b'), espera(12000, 'c')];
  entregas[2].catch(() => {});
  const plataformas = ['fluxer', 'discord', 'stoat'];
  const inicio = Date.now();
  const r = await aguardarEntregas(entregas, (i) => plataformas[i]);
  const ms = Date.now() - inicio;

  assert.equal(r[0].value, 'a');
  assert.equal(r[1].value, 'b');
  assert.equal(r[2].value, ATRASADO);
  assert.ok(ms < 8000, `esperou ${ms}ms`);
});

test('plataforma única lenta é aguardada por inteiro', async () => {
  const entregas = [espera(30, 'a'), espera(7000, 'b')];
  const r = await aguardarEntregas(entregas, () => 'fluxer');
  assert.equal(r[0].value, 'a');
  assert.equal(r[1].value, 'b');
});

test('falha rápida de uma plataforma é mantida como rejeitada', async () => {
  const entregas = [Promise.reject(new Error('x')), espera(10, 'ok')];
  const r = await aguardarEntregas(entregas, (i) => ['stoat', 'fluxer'][i]);
  assert.equal(r[0].status, 'rejected');
  assert.equal(r[1].value, 'ok');
});
