const { client } = require('../../lib/client');
const { DONO_ID, SUPORTE_GUILD_ID } = require('../../config');
const User = require('../../models/User');
const Bloqueio = require('../../models/Bloqueio');
const { extrairId } = require('../../util/ids');
const { log } = require('../../util/logger');
const { PREFIXO } = require('../../config');
const { sucesso, erro, usoIncorreto } = require('../../util/respostas');
const { tipoBloqueio, negarSeNaoStaff } = require('./_comum');

module.exports = {
  name: 'ban',
  aliases: ['bloquear'],
  description: 'Bloqueia um usuário ou servidor do global.',

  async execute(message, args) {
    if (await negarSeNaoStaff(message)) return;

    const tipo = tipoBloqueio(args[0]);
    const alvoId = extrairId(args[1]);
    if (!tipo || !alvoId) {
      await message.reply(usoIncorreto(message, PREFIXO, 'Vou me acalmar pra não disparar um ban à toa.', `${PREFIXO}ban usuario/servidor <@usuario ou ID> [motivo]`));
      return;
    }

    if (tipo === 'usuario') {
      if (alvoId === DONO_ID || alvoId === client.user.id || alvoId === String(message.author.id)) {
        await message.reply(erro('Isso não vai rolar', 'Você não pode bloquear esse usuário.'));
        return;
      }
      if (message.author.id !== DONO_ID && await User.exists({ userId: alvoId, staff: true })) {
        await message.reply(erro('Só o chefe', 'Somente o desenvolvedor do Global pode bloquear um staff.'));
        return;
      }
    } else if (alvoId === SUPORTE_GUILD_ID) {
      await message.reply(erro('Esse não', 'Você não pode bloquear o servidor de suporte.'));
      return;
    }

    const motivo = args.slice(2).join(' ').slice(0, 200) || null;
    await Bloqueio.findOneAndUpdate(
      { tipo, id: alvoId },
      { motivo, por: String(message.author.id), criadoEm: Date.now() },
      { upsert: true }
    );
    log.ok('BAN', `${tipo} ${alvoId} bloqueado por ${message.author.id}${motivo ? ` | ${motivo}` : ''}`);

    await message.reply(sucesso(
      tipo === 'usuario' ? 'Usuário bloqueado' : 'Servidor bloqueado',
      tipo === 'usuario'
        ? `<@${alvoId}> não manda mais mensagens no chat global.\n**Motivo:** ${motivo || 'não informado'}`
        : `O servidor \`${alvoId}\` foi tirado do chat global.\n**Motivo:** ${motivo || 'não informado'}`
    ));
  }
};
