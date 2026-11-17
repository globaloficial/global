const { PREFIXO } = require('../../config');
const { log, errMsg } = require('../../util/logger');
const { comandos, tratarComando } = require('../../handlers/commandHandler');
const { alterarPainelPorChave, botoesDoPainel } = require('../../services/paineis');
const { SEM_PERMISSAO } = require('../../util/respostas');
const { criarInteracaoCompat, normalizarResposta, podeGerenciar } = require('./compat');

const CATEGORIAS = ['conexao', 'geral'];

async function negar(interacao, texto) {
  await interacao.reply({ ...normalizarResposta(texto), ephemeral: true });
}

async function tratarPainel(interacao, partes) {
  const [, tipo, chave, donoId] = partes;
  if (interacao.user.id !== donoId) {
    await negar(interacao, 'Só quem abriu este painel pode usar os botões, use o comando para abrir o seu.');
    return;
  }
  if (!podeGerenciar(interacao.memberPermissions, interacao.user.id)) {
    await negar(interacao, SEM_PERMISSAO.painel);
    return;
  }
  const resultado = await alterarPainelPorChave(tipo, chave, interacao.guildId);
  if (!resultado) {
    await interacao.deferUpdate();
    return;
  }
  await interacao.update(normalizarResposta({ embeds: resultado.embeds, botoes: botoesDoPainel(tipo, donoId) }));
}

async function tratarComandoDoBotao(interacao, partes) {
  const [, donoId, nome, ...resto] = partes;
  if (interacao.user.id !== donoId) {
    await negar(interacao, 'Esse botão é de outra pessoa, use o comando para abrir o seu.');
    return;
  }
  if (!comandos.has(nome)) {
    await interacao.deferUpdate();
    return;
  }
  const argumentos = resto.join('|');
  const compat = criarInteracaoCompat(interacao, argumentos);
  await tratarComando(compat, `${PREFIXO}${nome} ${argumentos}`.trim(), CATEGORIAS);
  if (!compat.jaRespondeu() && !interacao.replied && !interacao.deferred) await interacao.deferUpdate();
}

async function abrirModal(interacao, partes) {
  const [, donoId, tipo] = partes;
  if (interacao.user.id !== donoId) {
    await negar(interacao, 'Esse botão é de outra pessoa, use o comando para abrir o seu.');
    return;
  }
  await interacao.showModal({
    custom_id: `modal|${donoId}|${tipo}`,
    title: 'Entrar em uma ponte',
    components: [{
      type: 1,
      components: [{ type: 4, custom_id: 'codigo', label: 'Código da ponte', style: 1, required: true, max_length: 32 }]
    }]
  });
}

async function tratarModal(interacao, partes) {
  const [, donoId] = partes;
  if (interacao.user.id !== donoId) return;
  const codigo = interacao.fields.getTextInputValue('codigo').trim();
  const compat = criarInteracaoCompat(interacao, `entrar ${codigo}`);
  await tratarComando(compat, `${PREFIXO}ponte entrar ${codigo}`, CATEGORIAS);
}

async function tratarComponente(interacao) {
  const partes = String(interacao.customId).split('|');
  try {
    if (partes[0] === 'painel') await tratarPainel(interacao, partes);
    else if (partes[0] === 'cmd') await tratarComandoDoBotao(interacao, partes);
    else if (partes[0] === 'modal-abrir') await abrirModal(interacao, partes);
    else if (partes[0] === 'modal') await tratarModal(interacao, partes);
    else return false;
    return true;
  } catch (e) {
    log.error('DISCORD', `Erro ao tratar botão ${partes[0]}: ${errMsg(e)}`, e);
    return false;
  }
}

module.exports = { tratarComponente };
