const { ehDev, PREFIXO } = require('../../config');
const { sucesso, info, SEM_PERMISSAO, usoIncorreto } = require('../../util/respostas');
const User = require('../../models/User');
const { ehSnowflake } = require('../../util/ids');
const { log, descreverContexto } = require('../../util/logger');

module.exports = {
  name: 'up',
  aliases: [],
  description: 'Promove um usuário a staff.',

  async execute(message, args) {
    if (!ehDev(message.author.id)) {
      log.warn('UP', `Acesso negado para ${descreverContexto(message)}`);
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
      await message.reply(usoIncorreto(message, PREFIXO, 'Vou me acalmar pra não promover o vento.', `${PREFIXO}up @usuario ou ${PREFIXO}up ID`));
      return;
    }

    await User.findOneAndUpdate({ userId: String(alvoId) }, { staff: true }, { upsert: true });
    log.ok('UP', `Usuário ${alvoId} promovido a Staff`);

    await message.reply(sucesso('Novo staff', `<@${alvoId}> foi promovido a **Staff**, bem-vindo à equipe!`));
  }
};
