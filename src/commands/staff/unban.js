const Bloqueio = require('../../models/Bloqueio');
const { extrairId } = require('../../util/ids');
const { log } = require('../../util/logger');
const { PREFIXO } = require('../../config');
const { sucesso, info, usoIncorreto } = require('../../util/respostas');
const { tipoBloqueio, negarSeNaoStaff } = require('./_comum');

module.exports = {
  name: 'unban',
  aliases: ['desbanir'],
  description: 'Desbloqueia um usuário ou servidor do global.',

  async execute(message, args) {
    if (await negarSeNaoStaff(message)) return;

    const tipo = tipoBloqueio(args[0]);
    const alvoId = extrairId(args[1]);
    if (!tipo || !alvoId) {
      await message.reply(usoIncorreto(message, PREFIXO, 'Vou me acalmar pra não perdoar qualquer um.', `${PREFIXO}unban usuario/servidor <@usuario ou ID>`));
      return;
    }

    const r = await Bloqueio.deleteOne({ tipo, id: alvoId });
    if (r.deletedCount > 0) {
      log.ok('UNBAN', `${tipo} ${alvoId} desbloqueado por ${message.author.id}`);
      await message.reply(sucesso(
        tipo === 'usuario' ? 'Usuário desbloqueado' : 'Servidor desbloqueado',
        tipo === 'usuario'
          ? `<@${alvoId}> voltou a poder mandar mensagens no chat global.`
          : `O servidor \`${alvoId}\` voltou a poder conectar ao chat global.`
      ));
    } else {
      await message.reply(info('Nada pra desbloquear', `Esse alvo não está bloqueado, use \`${PREFIXO}bloqueios\` para ver quem está.`));
    }
  }
};
