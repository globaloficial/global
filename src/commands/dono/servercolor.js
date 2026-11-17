const { ehDev, PREFIXO } = require('../../config');
const { EMOJI, montar, erro, SEM_PERMISSAO, usoIncorreto } = require('../../util/respostas');
const Guild = require('../../models/Guild');
const { ehSnowflake } = require('../../util/ids');
const { log, descreverContexto } = require('../../util/logger');

module.exports = {
  name: 'servercolor',
  aliases: [],
  description: 'Troca a cor das mensagens dos membros de um servidor.',

  async execute(message, args) {
    if (!ehDev(message.author.id)) {
      log.warn('SERVERCOLOR', `Acesso negado para ${descreverContexto(message)}`);
      await message.reply(SEM_PERMISSAO.dono);
      return;
    }

    if (args.length < 2) {
      await message.reply(usoIncorreto(message, PREFIXO, 'Vou me acalmar pra não pintar o servidor errado.', `${PREFIXO}servercolor <ID do servidor> <#HEX>`));
      return;
    }

    const targetGuildId = args[0];
    const hexStr = args[1].replace('#', '');

    if (!ehSnowflake(targetGuildId)) {
      await message.reply(erro('Esse ID não existe', 'Use apenas números no ID do servidor.'));
      return;
    }

    if (!/^[0-9a-fA-F]{6}$/.test(hexStr)) {
      await message.reply(erro('Essa cor não existe', 'Use um HEX com 6 dígitos, como `#2d8f31` ou `c0b29d`.'));
      return;
    }

    const corInt = parseInt(hexStr, 16);
    await Guild.findOneAndUpdate({ guildId: targetGuildId }, { cor: corInt }, { upsert: true });
    log.ok('SERVERCOLOR', `Cor do servidor ${targetGuildId} -> #${hexStr}`);

    await message.reply(montar(EMOJI.pincel, 'Cor atualizada', `A cor das mensagens do servidor \`${targetGuildId}\` agora é \`#${hexStr}\`.`));
  }
};
