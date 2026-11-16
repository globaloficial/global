const { EmbedBuilder } = require('@fluxerjs/core');
const { client } = require('../../lib/client');
const Bloqueio = require('../../models/Bloqueio');
const { EMOJI, info } = require('../../util/respostas');
const { negarSeNaoStaff } = require('./_comum');

const LIMITE_CAMPO = 3800;

function cortar(texto) {
  return texto.length > LIMITE_CAMPO ? `${texto.slice(0, LIMITE_CAMPO)}\n…` : texto;
}

function nomeDoServidor(id) {
  const guild = client.guilds.get(id);
  return guild && guild.name ? guild.name : `Servidor ${id}`;
}

function itemMotivo(posicao, titulo, motivo) {
  return `**${posicao}.** ${titulo}:\n\`${motivo || 'Motivo não informado'}\``;
}

module.exports = {
  name: 'bloqueios',
  aliases: [],
  description: 'Lista usuários e servidores bloqueados.',

  async execute(message) {
    if (await negarSeNaoStaff(message)) return;

    const lista = await Bloqueio.find().sort({ criadoEm: -1 }).lean();
    const servidores = lista.filter((b) => b.tipo === 'servidor');
    const usuarios = lista.filter((b) => b.tipo === 'usuario');

    if (lista.length === 0) {
      await message.reply(info('Tudo limpo por aqui', 'Nenhuma comunidade ou pessoa está bloqueada no Global, que bom, né?'));
      return;
    }

    const embeds = [];

    if (servidores.length > 0) {
      embeds.push(new EmbedBuilder()
        .setColor(0x0330EF)
        .setTitle(`${EMOJI.mundo} Comunidades Bloqueadas`)
        .setDescription(cortar(servidores.map((b, i) => itemMotivo(i + 1, nomeDoServidor(b.id), b.motivo)).join('\n'))));
    }

    if (usuarios.length > 0) {
      embeds.push(new EmbedBuilder()
        .setColor(0x0330EF)
        .setTitle(`${EMOJI.info} Pessoas Bloqueadas`)
        .setDescription(cortar(usuarios.map((b, i) => itemMotivo(i + 1, `<@${b.id}> (${b.id})`, b.motivo)).join('\n'))));
    }

    await message.reply({ embeds });
  }
};
