const test = require('node:test');
const assert = require('node:assert/strict');
require('./harness/falsos');
const { criarGerenciadorWebhooks } = require('../src/services/webhooks');
const { textoDoBotParaDiscord } = require('../src/util/conversao');

test('verificarWebhook tenta de novo mesmo depois de ter desistido do canal', async () => {
  let permitido = false;
  const gerenciador = criarGerenciadorWebhooks({
    montar: () => ({ delete: async () => {} }),
    buscarCanal: async () => ({
      createWebhook: async () => {
        if (!permitido) throw new Error('Missing Permissions');
        return { id: '1', token: 'tk' };
      }
    })
  });
  const destino = { guildId: 'g-atualizar', canalId: 'c-atualizar' };

  assert.equal(await gerenciador.obterWebhook(destino), null);
  assert.equal((await gerenciador.verificarWebhook(destino)).ok, false);

  permitido = true;
  assert.equal((await gerenciador.verificarWebhook(destino)).ok, true);
});

test('textos do bot no Discord usam os emojis personalizados do Discord', () => {
  const texto = textoDoBotParaDiscord('<:errorwarningfill:1563362758655746048> Não consegui');
  assert.equal(texto, '<:errorwarningfill:1571357860049195170> Não consegui');
});

test('prévia do reply mostra só o começo da mensagem, sem a linha do servidor', () => {
  const { limparPrevia, encurtarPrevia } = require('../src/services/chat/retransmissao');
  assert.equal(limparPrevia('<@123>\ndune manda algo ai\n-# Servidor do xMqR'), 'dune manda algo ai');
  assert.equal(encurtarPrevia('muito engraçado kkkk e continua com bastante texto depois'), 'muito engraçado kkkk e...');
  assert.equal(encurtarPrevia('curta'), 'curta');
});
