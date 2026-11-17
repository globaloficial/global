const { ehDev, PREFIXO } = require('../../config');
const { sucesso, info, SEM_PERMISSAO, usoIncorreto } = require('../../util/respostas');
const User = require('../../models/User');
const { ehSnowflake } = require('../../util/ids');
const { log, descreverContexto } = require('../../util/logger');

module.exports = {
  name: 'down',
  aliases: [],
  description: 'Remove um usuário da staff.',

  async execute(message, args) {
    if (!ehDev(message.author.id)) {
      log.warn('DOWN', `Acesso negado para ${descreverContexto(message)}`);
      await message.reply(SEM_PERMISSAO.dono);
      return;
    }

    let alvoId = null;
    if (message.mentions && message.mentions.users && message.mentions.users.size > 0) {
      alvoId = message.mentions.users.first().id;
    } else if (args[0] && ehSnowflake(args[0])) {
      alvoId = args[0];
    }

    if (!alvoId) {
      await message.reply(usoIncorreto(message, PREFIXO, 'Vou me acalmar pra não rebaixar o vento.', `${PREFIXO}down @usuario ou ${PREFIXO}down ID`));
      return;
    }

    const r = await User.findOneAndUpdate({ userId: String(alvoId), staff: true }, { staff: false });
    if (r) {
      log.ok('DOWN', `Staff removido: ${alvoId}`);
      await message.reply(sucesso('Staff removido', `O status de Staff de <@${alvoId}> foi removido.`));
    } else {
      await message.reply(info('Nada pra remover', 'Este usuário não está na lista de Staffs.'));
    }
  }
};
