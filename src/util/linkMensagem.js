function linkDaMensagem(plataforma, message, refId) {
  if (plataforma === 'stoat') {
    const app = (process.env.STOAT_APP_URL || 'https://stoat.chat').replace(/\/+$/, '');
    return `${app}/server/${message.guildId}/channel/${message.channel.id}/${refId}`;
  }
  const base = plataforma === 'discord' ? 'https://discord.com/channels' : 'https://fluxer.com/channels';
  return `${base}/${message.guildId}/${message.channel.id}/${refId}`;
}

module.exports = { linkDaMensagem };
