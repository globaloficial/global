const { log, descreverContexto } = require('../../util/logger');
const { temPermissaoConfig } = require('../../services/permissoes');
const { conexaoDoCanal, definirPausa } = require('../../services/conexoes');
const { PREFIXO } = require('../../config');
const { sucesso, erroSimples, SEM_PERMISSAO } = require('../../util/respostas');

async function alternarPausa(message, pausar) {
  if (!message.channel) return;

  if (!(await temPermissaoConfig(message))) {
    await message.reply(SEM_PERMISSAO.canais);
    return;
  }

  const conexao = await conexaoDoCanal(message);
  if (!conexao) {
    await message.reply(erroSimples(
      pausar ? 'Eu vou pausar o vento?' : 'Eu vou retomar o vento?',
      `Não há **nenhuma** conexão ativa neste canal (<#${message.channel.id}>), utilize o comando \`${PREFIXO}conectar\` para se juntar à **Conexão Global** ou utilize \`${PREFIXO}ponte\` para criar uma conexão própria.`
    ));
    return;
  }

  if (conexao.pausado === pausar) {
    await message.reply(erroSimples(
      pausar ? 'A conexão já está pausada.' : 'A conexão já está ativa.',
      pausar
        ? `A **${conexao.nome}** já está pausada, se você quer retomar utilize o comando \`${PREFIXO}retomar\` ou se você quer se livrar dela utilize \`${PREFIXO}desconectar\`.`
        : `A **${conexao.nome}** não está pausada, se você quer pausar utilize o comando \`${PREFIXO}pausar\` ou se você quer se livrar dela utilize \`${PREFIXO}desconectar\`.`,
      { abaixo: pausar ? 'Isso é código morse, ou um s.o.s disfarçado?' : 'Calma, ela já estava funcionando direitinho.' }
    ));
    return;
  }

  await definirPausa(conexao, pausar);
  log.ok(pausar ? 'PAUSAR' : 'RETOMAR', descreverContexto(message));

  await message.reply(pausar
    ? sucesso(
      'Pausado com sucesso',
      `Pausei com sucesso a **${conexao.nome}**, caso você já terminou de respirar e gostaria de voltar, utilize o comando \`${PREFIXO}retomar\`.`,
      { acima: 'Uma pausa vai bem né?' }
    )
    : sucesso(
      'Retomado com sucesso',
      `Retomei com sucesso a **${conexao.nome}**, as mensagens voltam a chegar e a sair normalmente, caso precise de outra pausa, utilize o comando \`${PREFIXO}pausar\`.`,
      { acima: 'Bem-vindo de volta!' }
    ));
}

module.exports = { alternarPausa };
