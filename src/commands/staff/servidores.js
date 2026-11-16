const { EmbedBuilder } = require('@fluxerjs/core');
const { client } = require('../../lib/client');
const Guild = require('../../models/Guild');
const Bloqueio = require('../../models/Bloqueio');
const { EMOJI, info } = require('../../util/respostas');
const { negarSeNaoStaff } = require('./_comum');

module.exports = {
  name: 'servidores',
  aliases: [],
  description: 'Lista os servidores conectados ao global.',

  async execute(message) {
    if (await negarSeNaoStaff(message)) return;

    const [lista, bloqueados] = await Promise.all([
      Guild.find({ canalId: { $ne: null } }).lean(),
      Bloqueio.find({ tipo: 'servidor' }).distinct('id')
    ]);

    if (lista.length === 0) {
      await message.reply(info('Ninguém por aqui', 'Nenhum servidor está conectado ao Global agora, que silêncio, né?'));
      return;
    }

    const bloqueadosSet = new Set(bloqueados);
    let texto = lista.map((c, i) => {
      const g = client.guilds.get(c.guildId);
      const nome = g && g.name ? g.name : 'Desconhecido';
      const estado = bloqueadosSet.has(c.guildId) ? 'Conexão Global (bloqueado)' : c.pausado ? 'Conexão Global (pausada)' : 'Conexão Global';
      return `**${i + 1}.** ${nome}:\n\`${estado}\``;
    }).join('\n');
    if (texto.length > 3800) texto = `${texto.slice(0, 3800)}\n…`;

    const embed = new EmbedBuilder()
      .setColor(0x0330EF)
      .setTitle(`${EMOJI.mundo} Comunidades Conectadas`)
      .setDescription(texto);

    await message.reply({ embeds: [embed] });
  }
};
