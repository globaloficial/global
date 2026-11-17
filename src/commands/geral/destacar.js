const { EmbedBuilder } = require('@fluxerjs/core');
const User = require('../../models/User');
const { ROTULO_BADGE, PREFIXO } = require('../../config');
const { badgesDoUsuario, badgeAtiva, resolverBadge, selecionarBadge } = require('../../services/badges');
const { badges: emojisBadges } = require('../../util/emojis');
const { EMOJI, sucesso, info, erro } = require('../../util/respostas');

const LIMPAR = ['nenhuma', 'nenhum', 'limpar', 'remover'];
const TODAS = Object.keys(ROTULO_BADGE);

function formatar(badge) {
  return `${emojisBadges[badge] ?? ''} ${ROTULO_BADGE[badge] ?? badge}`.trim();
}

function listar(badges, atual) {
  if (badges.length === 0) return 'Nenhuma';
  return badges.map((b) => `${formatar(b)}${b === atual ? ' *(em destaque)*' : ''}`).join(', ');
}

function embedsDaLista(possui, atual, discord = false) {
  const faltam = TODAS.filter((b) => !possui.includes(b));

  const intro = new EmbedBuilder()
    .setColor(0x0330EF)
    .setTitle(`${EMOJI.coracao} Suas badges`)
    .setDescription('Essas são as suas badges ganhas no Global, ganhe badges interagindo, contribuindo com o projeto e principalmente sendo muito legal!');

  const disponiveis = new EmbedBuilder()
    .setColor(0x0330EF)
    .setTitle('Badges Disponíveis')
    .addFields(
      { name: `${EMOJI.ligado} Obtidas e Disponíveis para o uso:`, value: listar(possui, atual), inline: true },
      { name: `${EMOJI.desligado} Ainda não obtidas:`, value: faltam.length ? faltam.map(formatar).join(', ') : 'Você tem todas, uau!', inline: true },
      { name: 'Como trocar suas badges?', value: `${discord ? 'Clique no botão da badge desejada ou use' : 'Use'} \`${PREFIXO}destacar (nome da badge)\` para destacar a badge desejada no seu perfil e nas suas mensagens enviadas. (\`${PREFIXO}perfil\`)`, inline: true }
    );

  return [intro, disponiveis];
}

module.exports = {
  name: 'destacar',
  aliases: ['selecionar'],
  description: 'Escolhe a badge em destaque no seu perfil e na cor das suas mensagens.',

  async execute(message, args) {
    const userId = String(message.author.id);
    const usuario = await User.findOne({ userId }).lean();
    const possui = badgesDoUsuario(usuario);
    const atual = badgeAtiva(usuario);
    const escolha = (args[0] || '').toLowerCase();

    if (!escolha) {
      if (possui.length === 0) {
        await message.reply(info('Nada por aqui...', 'Você ainda não ganhou nenhuma badge, converse no chat global que elas vão aparecendo.'));
        return;
      }
      if (message.plataforma === 'discord') {
        const botoes = possui.map((b) => ({
          id: `cmd|${userId}|destacar|${b}`,
          rotulo: ROTULO_BADGE[b] ?? b,
          estilo: b === atual ? 'primary' : 'secondary',
          emoji: emojisBadges[b]
        }));
        botoes.push({ id: `cmd|${userId}|destacar|limpar`, rotulo: 'Nenhuma', estilo: 'danger', emoji: null });
        await message.reply({ embeds: embedsDaLista(possui, atual, true), botoes });
        return;
      }
      await message.reply({ embeds: embedsDaLista(possui, atual) });
      return;
    }

    if (LIMPAR.includes(escolha)) {
      await selecionarBadge(userId, null);
      await message.reply(sucesso('Destaque removido', 'Tirei o destaque, agora vale a badge de maior prioridade que você tem.'));
      return;
    }

    const badge = resolverBadge(escolha);
    if (!badge || !possui.includes(badge)) {
      await message.reply(erro(
        'Você não tem essa badge',
        `Você ainda não possui essa badge, use \`${PREFIXO}destacar\` para ver as que você tem.`
      ));
      return;
    }

    await selecionarBadge(userId, badge);
    await message.reply(sucesso('Badge em destaque', `A badge **${formatar(badge)}** agora brilha no seu perfil e dá cor às suas mensagens.`));
  }
};
