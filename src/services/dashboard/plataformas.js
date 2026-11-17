const { PermissionFlags } = require('@fluxerjs/core');
const { PermissionFlagsBits } = require('discord.js');
const { client } = require('../../lib/client');
const { discordClient } = require('../../lib/discordClient');
const { obterIconeServidor } = require('../chat/mensagem');

const PLATAFORMAS = ['fluxer', 'discord'];
const TIPOS_TEXTO = [0, 5];

function guildDe(plataforma, guildId) {
  const id = String(guildId);
  if (plataforma === 'fluxer') return client.guilds.get(id) || null;
  if (plataforma === 'discord') return discordClient.isReady() ? discordClient.guilds.cache.get(id) || null : null;
  return null;
}

function todasAsGuilds(plataforma) {
  if (plataforma === 'fluxer') return Array.from(client.guilds.values());
  if (plataforma === 'discord' && discordClient.isReady()) return Array.from(discordClient.guilds.cache.values());
  return [];
}

async function buscarMembro(plataforma, guild, userId) {
  try {
    if (plataforma === 'fluxer') return await guild.fetchMember(String(userId));
    return await guild.members.fetch(String(userId));
  } catch {
    return null;
  }
}

async function permissoesDoUsuario(plataforma, guild, userId) {
  const dono = String(guild.ownerId) === String(userId);
  const membro = dono ? null : await buscarMembro(plataforma, guild, userId);
  const permissoes = membro ? membro.permissions : null;
  const flags = plataforma === 'fluxer' ? PermissionFlags : PermissionFlagsBits;

  const administrador = dono || Boolean(permissoes && permissoes.has(flags.Administrator));
  const gerenciaCanais = administrador || Boolean(permissoes && permissoes.has(flags.ManageChannels));

  return { dono, administrador, gerenciaCanais, pode: gerenciaCanais };
}

function resumoDoServidor(plataforma, guild) {
  return {
    plataforma,
    id: String(guild.id),
    nome: guild.name || `Servidor ${guild.id}`,
    icone: obterIconeServidor(guild)
  };
}

function ehCanalDeTexto(canal) {
  return TIPOS_TEXTO.includes(Number(canal.type));
}

async function listarCanais(plataforma, guild) {
  let canais;

  if (plataforma === 'fluxer') {
    try {
      canais = await guild.fetchChannels();
    } catch {
      canais = Array.from(guild.channels.values());
    }
  } else {
    canais = Array.from(guild.channels.cache.values());
  }

  return canais
    .filter(ehCanalDeTexto)
    .sort((a, b) => Number(a.position ?? a.rawPosition ?? 0) - Number(b.position ?? b.rawPosition ?? 0))
    .map((canal) => ({ id: String(canal.id), nome: canal.name, nsfw: Boolean(canal.nsfw) }));
}

module.exports = {
  PLATAFORMAS,
  guildDe,
  todasAsGuilds,
  permissoesDoUsuario,
  resumoDoServidor,
  listarCanais
};
