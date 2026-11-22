const { client } = require('../../lib/client');
const { obterPlataforma, nomeDoServidor } = require('../../plataformas');
const { discordClient } = require('../../lib/discordClient');
const { COOLDOWN_PERFIL } = require('../../config');
const User = require('../../models/User');
const { badgesDoUsuario, badgeAtiva } = require('../../services/badges');
const { totalMensagens, servidorMaisAtivo } = require('../../services/perfilDados');
const { gerarCardPerfil } = require('../../util/render/cardPerfil');
const { extrairId } = require('../../util/ids');
const { log } = require('../../util/logger');
const { erro, espera } = require('../../util/respostas');

const cooldownPerfil = new Map();

async function resolverAlvo(message, args) {
  const mencionado = message.mentions && message.mentions.users && message.mentions.users.first();
  if (mencionado) return mencionado;

  const id = extrairId(args[0]);
  if (!id) return message.author;

  try {
    if (message.plataforma === 'stoat') return await obterPlataforma('stoat').buscarUsuario(id);
    return await (message.plataforma === 'discord' ? discordClient : client).users.fetch(id);
  } catch {
    return null;
  }
}

module.exports = {
  name: 'perfil',
  aliases: ['profile'],
  description: 'Mostra o card de perfil seu ou de outro usuário.',

  async execute(message, args) {
    const ultimo = cooldownPerfil.get(message.author.id);
    if (ultimo && Date.now() - ultimo < COOLDOWN_PERFIL) {
      await message.reply(espera('Calma, tá com pressa?', 'Aguarde alguns segundos antes de pedir outro perfil, o Global também precisa respirar.'));
      return;
    }
    cooldownPerfil.set(message.author.id, Date.now());

    const alvo = await resolverAlvo(message, args);
    if (!alvo) {
      await message.reply(erro('Quem é esse?', 'Não encontrei nenhum usuário com essa menção ou ID, confere se digitou certinho e tenta de novo.'));
      return;
    }

    try {
      const [usuario, mensagens, topo] = await Promise.all([
        User.findOne({ userId: String(alvo.id) }).lean(),
        totalMensagens(alvo.id),
        servidorMaisAtivo(alvo.id)
      ]);

      const servidor = topo
        ? (client.guilds.get(topo.guildId)?.name ?? discordClient.guilds.cache.get(topo.guildId)?.name ?? nomeDoServidor(topo.guildId, 'stoat') ?? 'Servidor desconhecido')
        : 'Sem atividade recente';

      const card = await gerarCardPerfil({
        username: alvo.username,
        displayName: alvo.globalName || alvo.username,
        avatar: alvo.displayAvatarURL({ size: 256, extension: 'png' }),
        badges: badgesDoUsuario(usuario),
        selectedBadge: badgeAtiva(usuario),
        mensagens,
        contaCriada: alvo.createdTimestamp,
        servidor,
        servidorMensagens: topo ? topo.total : null
      });

      await message.reply({ files: [{ name: `perfil-${alvo.id}.png`, data: card }] });
    } catch (e) {
      log.error('PERFIL', `Falha ao gerar o perfil de ${alvo.id}`, e);
      await message.reply(erro('Deu ruim no card', 'Não consegui gerar o perfil agora, tente de novo daqui a pouco.'));
    }
  }
};
