const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/falsos');
const { registrarPlataforma } = require('../src/plataformas');
const { espelharReacao, emojiUnicode } = require('../src/services/reacoes');

const reagidas = [];

function adaptador(nome) {
  return {
    nome,
    buscarMensagem: async (canalId, msgId) => ({
      content: 'kkkkkkkkkkkkk',
      author: { username: 'dune' },
      react: async (emoji) => reagidas.push(`${nome}:${canalId}:${msgId}:${emoji}`)
    }),
    buscarUsuario: async (id) => ({ username: `user-${id}` })
  };
}

registrarPlataforma(adaptador('fluxer'));
registrarPlataforma(adaptador('discord'));

test('só emoji padrão passa pelo filtro', () => {
  assert.equal(emojiUnicode({ id: null, name: '❤️' }), '❤️');
  assert.equal(emojiUnicode({ id: '123', name: 'heart2fill' }), null);
  assert.equal(emojiUnicode('<:heart2fill:123>'), null);
});

test('reação em uma cópia aparece nas outras mensagens do grupo', async () => {
  H.dados.set('MensagemGlobal', []);
  H.dados.get('MensagemGlobal').push({ grupoId: 'm1', guildId: 'a', plataforma: 'fluxer', canalId: 'ca', msgId: 'm1', autorId: 'u' });
  H.dados.get('MensagemGlobal').push({ grupoId: 'm1', guildId: 'b', plataforma: 'discord', canalId: 'cb', msgId: 'm2', autorId: 'u' });
  H.dados.get('MensagemGlobal').push({ grupoId: 'm1', guildId: 'c', plataforma: 'fluxer', canalId: 'cc', msgId: 'm3', autorId: 'u' });

  await espelharReacao({ msgId: 'm1', emoji: { id: null, name: '❤️' }, bot: false });
  assert.deepEqual(reagidas.sort(), ['discord:cb:m2:❤️', 'fluxer:cc:m3:❤️']);

  await espelharReacao({ msgId: 'm2', emoji: { id: null, name: '❤️' }, bot: false });
  assert.equal(reagidas.length, 2);
});

test('reação de bot ou emoji personalizado é ignorada', async () => {
  reagidas.length = 0;
  await espelharReacao({ msgId: 'm1', emoji: { id: null, name: '🔥' }, bot: true });
  await espelharReacao({ msgId: 'm1', emoji: { id: '9', name: 'x' }, bot: false });
  assert.equal(reagidas.length, 0);
});

test('verreação lista quem reagiu e usa a etiqueta da outra plataforma', async () => {
  const comando = require('../src/commands/geral/verreacao');
  H.dados.set('MensagemGlobal', []);
  H.dados.set('ReacaoGlobal', []);
  H.dados.get('MensagemGlobal').push(
    { grupoId: 'o1', guildId: 'a', plataforma: 'discord', canalId: 'ca', msgId: 'o1', autorId: 'u' },
    { grupoId: 'o1', guildId: 'b', plataforma: 'fluxer', canalId: 'cb', msgId: 'c1', autorId: 'u' }
  );
  await espelharReacao({ msgId: 'c1', emoji: { id: null, name: '💙' }, usuarioId: 'x1', plataforma: 'discord', bot: false });
  await espelharReacao({ msgId: 'o1', emoji: { id: null, name: '🤠' }, usuarioId: 'x2', plataforma: 'fluxer', bot: false });

  const respostas = [];
  const mensagem = (plataforma, ref) => ({
    plataforma,
    guildId: 'b',
    channel: { id: 'cb' },
    messageReference: ref ? { messageId: ref } : null,
    reply: async (r) => respostas.push(r)
  });

  await comando.execute(mensagem('fluxer', null));
  assert.match(respostas[0], /Cadê a mensagem/);

  await comando.execute(mensagem('fluxer', 'zzz'));
  assert.match(respostas[1], /Mensagem inválida/);

  await comando.execute(mensagem('fluxer', 'c1'));
  const descricao = respostas[2].embeds[0].data.description;
    assert.match(descricao, /\[Discord\] \[dune\]\(https:\/\/discord\.com\/users\/u\): \[kkkkkkkkkkkkk\]\(https:\/\/fluxer\.com\/channels\/b\/cb\/c1\)/);
  assert.match(descricao, /\[Discord\] \[user-x1\]\(https:\/\/discord\.com\/users\/x1\): Reagiu com 💙/);
  assert.match(descricao, /\n\[user-x2\]\(https:\/\/fluxer\.com\/users\/x2\): Reagiu com 🤠/);

  await comando.execute(mensagem('discord', 'c1'));
  assert.match(respostas[3].embeds[0].data.description, /\n---\n/);

  H.dados.set('ReacaoGlobal', []);
  await comando.execute(mensagem('fluxer', 'c1'));
  assert.match(respostas[4], /Sem reações/);
});
