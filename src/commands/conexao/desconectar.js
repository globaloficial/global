const { log, descreverContexto } = require('../../util/logger');
const { temPermissaoConfig } = require('../../services/permissoes');
const { conexaoDoCanal, desligar } = require('../../services/conexoes');
const { PREFIXO } = require('../../config');
const { sucesso, erroSimples, SEM_PERMISSAO } = require('../../util/respostas');

module.exports = {
  name: 'desconectar',
  aliases: [],
  description: 'Desconecta a conexão deste canal.',

  async execute(message) {
    if (!message.channel) return;

    if (!(await temPermissaoConfig(message))) {
      await message.reply(SEM_PERMISSAO.canais);
      return;
    }

    const conexao = await conexaoDoCanal(message);
    if (!conexao) {
      await message.reply(erroSimples(
        'Eu vou desconectar o vento?',
        `Este canal não possui **nenhuma** conexão ativa, que tal usar \`${PREFIXO}conectar\` para começar a conversar com pessoas ~~estranhas~~ legais?`
      ));
      return;
    }

    await desligar(conexao);
    log.ok('DESCONECTAR', `${conexao.nome} desconectada | ${descreverContexto(message)}`);
    await message.reply(sucesso(
      'Desconectado com sucesso',
      `Desconectei a **${conexao.nome}** deste canal (<#${message.channel.id}>) agora você pode enviar mensagens sem se preocupar em passar vergonha em todo o bot.`
    ));
  }
};
