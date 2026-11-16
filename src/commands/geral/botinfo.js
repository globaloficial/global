const { EmbedBuilder } = require('@fluxerjs/core');
const { DONO_ID, MUBI_ID, PREFIXO } = require('../../config');
const Guild = require('../../models/Guild');
const { EMOJI } = require('../../util/respostas');
const { discordClient } = require('../../lib/discordClient');

const CONTRIBUIDORES = {
  fluxer: [
    { id: DONO_ID, nome: 'xMqR', funcao: 'Head Dev' },
    { id: MUBI_ID, nome: 'Mubi', funcao: 'Dev' },
    { id: '1547741588283723777', nome: 'supreminhogamer', funcao: 'Code Contributor' },
    { id: '1473035366593507373', nome: 'joão', funcao: 'Financial Contributor' }
  ],
  discord: [
    { id: '1035619333730205846', nome: 'xMqR', funcao: 'Head Dev' },
    { id: '1160426569156808734', nome: 'Mubi', funcao: 'Dev' },
    { id: '850162520391548969', nome: 'supreminhogamer', funcao: 'Code Contributor' },
    { id: '1293531630694039563', nome: 'joão', funcao: 'Financial Contributor' }
  ]
};

function servidoresNoDiscord() {
  try {
    return discordClient.isReady() ? discordClient.guilds.cache.size : null;
  } catch (_) {
    return null;
  }
}

function linhaDe(contribuidor) {
  const nome = contribuidor.id ? `<@${contribuidor.id}>` : `**@${contribuidor.nome}**`;
  return `${nome} (${contribuidor.funcao})`;
}

module.exports = {
  name: 'botinfo',
  aliases: ['global'],
  description: 'Envia as informações principais do Global.',

  async execute(message) {
    const plataforma = message.plataforma === 'discord' ? 'discord' : 'fluxer';
    const comunidades = await Guild.countDocuments({ canalId: { $ne: null } });
    const noDiscord = servidoresNoDiscord();
    const dados = [
      'Linguagem: `JavaScript (Node.js)`',
      'Bibliotecas: `@fluxerjs/core` e `discord.js`',
      'Banco de dados: `MongoDB`',
      `Prefixo: \`${PREFIXO}\``,
      'Status: `Operacional`'
    ];
    const estatisticas = `Presente em **${comunidades}** comunidades${noDiscord === null ? '' : `, sendo **${noDiscord}** servidores no Discord`}, veja outras estatísticas em globalbot.site/estatisticas`;

    const embed = new EmbedBuilder()
      .setColor(0x0330EF)
      .setTitle(`${EMOJI.mundo} Informações do Global`)
      .setDescription('O Global é um bot do Fluxer e do Discord criado para o público brasileiro. Ele conecta comunidades em um chat global: o que alguém escreve no canal conectado de um servidor é retransmitido para os canais conectados dos outros servidores.')
      .addFields(
        { name: `${EMOJI.coracao} Contribuidores:`, value: CONTRIBUIDORES[plataforma].map(linhaDe).join('\n'), inline: true },
        { name: `${EMOJI.janela} Estatísticas`, value: estatisticas, inline: true },
        { name: 'Saiba mais em:', value: 'https://globalbot.site/', inline: true },
        {
          name: `${EMOJI.terminal} Dados Técnicos:`,
          value: dados.join('\n'),
          inline: false
        }
      );

    await message.reply({ embeds: [embed] });
  }
};
