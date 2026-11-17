const { EmbedBuilder } = require('@fluxerjs/core');
const { EMOJI } = require('../../util/respostas');

module.exports = {
  name: 'ajuda',
  aliases: ['help', 'comandos'],
  description: 'Apresenta o Global e os links principais.',

  async execute(message) {
    const embed = new EmbedBuilder()
      .setColor(0x0330EF)
      .setTitle(`${EMOJI.coracao} Olá! Eu sou o Global.`)
      .setDescription('O Global é um bot do Fluxer criado para o público brasileiro. Ele conecta comunidades em um chat global: o que alguém escreve no canal conectado de um servidor é retransmitido para os canais conectados dos outros servidores.')
      .addFields(
        { name: `${EMOJI.janela} Visite o site do Global:`, value: 'https://globalbot.site/', inline: true },
        { name: `${EMOJI.privado} Leia as nossas Políticas de Privacidade:`, value: 'https://docs.globalbot.site/politicas', inline: true },
        { name: `${EMOJI.conversa} Acesse os comandos do Global:`, value: 'https://globalbot.site/comandos', inline: true }
      );

    await message.reply({ embeds: [embed] });
  }
};
