const { EmbedBuilder } = require('@fluxerjs/core');
const { client } = require('../../lib/client');
const { discordClient } = require('../../lib/discordClient');
const { nivelDeRisco } = require('../../services/riscoRateLimit');
const { EMOJI, SUPORTE } = require('../../util/respostas');

async function medirApi(plataforma) {
  const discord = plataforma === 'discord';
  const inicio = Date.now();
  try {
    if (plataforma === 'stoat') await require('../../plataformas/stoat/api').euMesmo();
    else if (discord) await discordClient.rest.get('/users/@me');
    else await client.rest.get('/users/@me');
    return Math.max(0, Date.now() - inicio);
  } catch (_) {
    return null;
  }
}

function medirGateway(plataforma) {
  const discord = plataforma === 'discord';
  if (plataforma === 'stoat') return null;
  try {
    const ping = discord ? discordClient.ws.ping : client.ws.ping;
    return Number.isFinite(ping) && ping >= 0 ? ping : null;
  } catch (_) {
    return null;
  }
}

function formatar(ms) {
  return ms === null ? '`Indisponível`' : `\`${ms} ms\``;
}

module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Mostra a latência do Global e o risco de rate limit.',

  async execute(message) {
    const plataforma = message.plataforma || 'fluxer';
    const api = await medirApi(plataforma);
    const gateway = medirGateway(plataforma);

    const embed = new EmbedBuilder()
      .setColor(0x0330EF)
      .setTitle(`${EMOJI.pingue} Eu com certeza não vou falar pong.`)
      .setDescription(`-# O Global pode sofrer alterações conforme a atividade da Conexão Global, mesmo que seja improvável, nada é assegurado, viu algum erro? Entre em contato com a [nossa equipe](${SUPORTE}).`)
      .addFields(
        { name: 'API Ping:', value: formatar(api), inline: true },
        { name: 'Gateway Ping:', value: formatar(gateway), inline: true },
        { name: 'Risco de Rate Limit:', value: `\`${nivelDeRisco()}\``, inline: true }
      );

    await message.reply({ embeds: [embed] });
  }
};
