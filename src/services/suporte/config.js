const lista = (valor) => String(valor || '').split(',').map((item) => item.trim()).filter(Boolean);

const SITE = (process.env.SUPORTE_SITE || 'https://support.globalbot.site').replace(/\/$/, '');

const DASH_SITE = (process.env.DASH_SITE || 'https://dash.globalbot.site').replace(/\/$/, '');

const API = (process.env.SUPORTE_API || 'https://api.globalbot.site').replace(/\/$/, '');

const SEGREDO = process.env.SUPORTE_SEGREDO || '';

const DOMINIO_COOKIE = process.env.SUPORTE_DOMINIO_COOKIE || '.globalbot.site';

const SESSAO_MS = 7 * 24 * 60 * 60 * 1000;

const LIMITES = {
  assunto: 120,
  texto: 2000,
  abertasPorUsuario: 3,
  corpoBytes: 16 * 1024,
  requisicoesPorMinuto: 20
};

const PROVEDORES = {
  fluxer: {
    nome: 'Fluxer',
    clientId: process.env.FLUXER_CLIENT_ID || '',
    clientSecret: process.env.FLUXER_CLIENT_SECRET || '',
    autorizar: process.env.FLUXER_AUTORIZAR_URL || 'https://web.fluxer.app/oauth2/authorize',
    token: `${process.env.FLUXER_API_URL || 'https://api.fluxer.app/v1'}/oauth2/token`,
    usuario: `${process.env.FLUXER_API_URL || 'https://api.fluxer.app/v1'}/users/@me`,
    escopo: 'identify',
    avatar: (id, hash) => `https://fluxerusercontent.com/avatars/${id}/${hash}.png?size=128`,
    staff: lista(process.env.STAFF_FLUXER)
  },
  discord: {
    nome: 'Discord',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    autorizar: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    usuario: 'https://discord.com/api/users/@me',
    escopo: 'identify',
    avatar: (id, hash) => `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`,
    staff: lista(process.env.STAFF_DISCORD)
  }
};

const suporteAtivo = () => Boolean(SEGREDO) && Object.values(PROVEDORES).some((p) => p.clientId && p.clientSecret);

module.exports = { SITE, DASH_SITE, API, SEGREDO, DOMINIO_COOKIE, SESSAO_MS, LIMITES, PROVEDORES, suporteAtivo };
