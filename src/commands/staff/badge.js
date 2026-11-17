const User = require('../../models/User');
const { ROTULO_BADGE, PREFIXO } = require('../../config');
const { sucesso, info, erro, usoIncorreto } = require('../../util/respostas');
const { badgesDoUsuario, resolverBadge, concederBadge, removerBadge, esquecerConversador } = require('../../services/badges');
const { badges: emojisBadges } = require('../../util/emojis');
const { extrairId } = require('../../util/ids');
const { log } = require('../../util/logger');
const { negarSeNaoStaff } = require('./_comum');

const TODAS = Object.keys(ROTULO_BADGE);

function formatar(badge) {
  return `${emojisBadges[badge] ?? ''} ${ROTULO_BADGE[badge] ?? badge}`.trim();
}

function acaoDe(token) {
  const t = (token || '').toLowerCase();
  if (['add', 'adicionar', 'dar'].includes(t)) return 'add';
  if (['remove', 'remover', 'rm'].includes(t)) return 'remove';
  if (['list', 'listar', 'ver'].includes(t)) return 'list';
  return null;
}

module.exports = {
  name: 'badge',
  aliases: ['badges'],
  description: 'Concede, remove ou lista as badges de um usuário.',

  async execute(message, args) {
    if (await negarSeNaoStaff(message)) return;

    const acao = acaoDe(args[0]);
    const alvoId = extrairId(args[1]);
    if (!acao || !alvoId) {
      await message.reply(usoIncorreto(message, PREFIXO, 'Vou me acalmar pra não disparar uma badge à toa.', `${PREFIXO}badge dar/remover/listar @usuario (nome da badge)`));
      return;
    }

    if (acao === 'list') {
      const usuario = await User.findOne({ userId: alvoId }).lean();
      const lista = badgesDoUsuario(usuario);
      const faltam = TODAS.filter((b) => !lista.includes(b));
      await message.reply(info(
        `Badges de ${usuario ? `<@${alvoId}>` : `<@${alvoId}>`}`,
        `**Obtidas:** ${lista.length ? lista.map(formatar).join(', ') : 'nenhuma'}\n**Ainda não obtidas:** ${faltam.length ? faltam.map(formatar).join(', ') : 'nenhuma, tem todas!'}`
      ));
      return;
    }

    const badge = resolverBadge(args[2]);
    if (!badge) {
      await message.reply(erro('Essa badge não existe', `Não conheço essa badge, as que existem são: ${TODAS.map((b) => ROTULO_BADGE[b]).join(', ')}.`));
      return;
    }
    if (badge === 'staff') {
      await message.reply(erro('Essa é controlada', `A badge **Staff** é controlada por \`${PREFIXO}up\` e \`${PREFIXO}down\`.`));
      return;
    }

    if (acao === 'add') {
      await concederBadge(alvoId, badge);
      log.ok('BADGE', `${badge} concedida a ${alvoId} por ${message.author.id}`);
      await message.reply(sucesso('Badge entregue', `<@${alvoId}> agora tem a badge **${formatar(badge)}**, o perfil só melhorou.`));
      return;
    }

    const usuario = await User.findOne({ userId: alvoId }).lean();
    if (!badgesDoUsuario(usuario).includes(badge)) {
      await message.reply(erro('Nada pra remover', `<@${alvoId}> não possui a badge **${formatar(badge)}**, use \`${PREFIXO}badge listar @usuario\` para ver as dele.`));
      return;
    }

    await removerBadge(alvoId, badge);
    if (badge === 'active') esquecerConversador(alvoId);
    log.ok('BADGE', `${badge} removida de ${alvoId} por ${message.author.id}`);
    await message.reply(sucesso('Badge removida', `Tirei a badge **${formatar(badge)}** de <@${alvoId}>.`));
  }
};
