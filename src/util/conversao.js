const { EMOJIS } = require('../plataformas/discord/emojis');

const UNICODE_POR_NOME = {
  closecirclefill: '❌',
  checkboxcirclefill: '✅',
  checkboxfill: '☑️',
  togglefill: '🟢',
  toggleline: '⚪',
  information2fill: 'ℹ️',
  errorwarningfill: '⚠️',
  chat1fill: '💬',
  imagefill: '🖼️',
  earthline1: '🌍',
  heart2fill: '❤️',
  brushaifill: '✨',
  forbidline: '🚫'
};

const COMANDOS_SLASH = new Set(['ping', 'ajuda', 'botinfo', 'conectar', 'desconectar', 'pausar', 'retomar', 'config', 'automod', 'ponte', 'perfil', 'destacar', 'atualizar']);

const EMOJI_PERSONALIZADO = /<a?:([\w~]+):\d+>/g;
const EMOJI_PERSONALIZADO_UNICO = /^<a?:([\w~]+):\d+>$/;
const COMANDO_COM_PREFIXO = /\bg\.([a-zà-ú]+)/gi;
const NOMES_PROIBIDOS_NO_WEBHOOK = /(clyde|discord)/gi;

function emojiPersonalizadoParaUnicode(texto) {
  return String(texto).replace(EMOJI_PERSONALIZADO, (_, nome) => UNICODE_POR_NOME[nome] || `:${nome}:`);
}

function comandosParaSlash(texto) {
  return String(texto).replace(COMANDO_COM_PREFIXO, (trecho, nome) => {
    const minusculo = nome.toLowerCase();
    return COMANDOS_SLASH.has(minusculo) ? `/${minusculo}` : trecho;
  });
}

function emojiDoDiscord(nome) {
  const par = EMOJIS[nome];
  return par ? `<:${par[0]}:${par[1]}>` : null;
}

function emojiPersonalizadoParaDiscord(texto) {
  return String(texto).replace(EMOJI_PERSONALIZADO, (_, nome) => emojiDoDiscord(nome) || UNICODE_POR_NOME[nome] || '');
}

function textoDoBotParaDiscord(texto) {
  return comandosParaSlash(emojiPersonalizadoParaDiscord(texto));
}

function emojiParaReacaoDiscord(emoji) {
  const encontrado = String(emoji).match(EMOJI_PERSONALIZADO_UNICO);
  if (!encontrado) return emoji;
  const par = EMOJIS[encontrado[1]];
  return par ? `${par[0]}:${par[1]}` : UNICODE_POR_NOME[encontrado[1]] || '❓';
}

const ID_MENCAO = '(?:\\d+|[0-9A-HJKMNP-TV-Z]{26})';
const EMOJI_STOAT = /:[0-9A-HJKMNP-TV-Z]{26}:/g;

function converterConteudo(texto, origem, destino) {
  if (!texto || origem === destino) return texto;
  return String(texto)
    .replace(EMOJI_PERSONALIZADO, ':$1:')
    .replace(EMOJI_STOAT, ':emoji:')
    .replace(/<@&\d+>/g, '@cargo')
    .replace(new RegExp(`<@!?${ID_MENCAO}>`, 'g'), '@usuário')
    .replace(new RegExp(`<#${ID_MENCAO}>`, 'g'), '#canal')
    .replace(/@(everyone|here)\b/g, '@\u200b$1');
}

function nomeWebhookDiscord(nome) {
  return String(nome)
    .replace(NOMES_PROIBIDOS_NO_WEBHOOK, (trecho) => `${trecho[0]}\u200b${trecho.slice(1)}`)
    .slice(0, 80);
}

function limitar(texto, maximo) {
  const valor = String(texto);
  return valor.length > maximo ? `${valor.slice(0, maximo - 1)}…` : valor;
}

module.exports = {
  COMANDOS_SLASH,
  emojiPersonalizadoParaUnicode,
  emojiPersonalizadoParaDiscord,
  comandosParaSlash,
  textoDoBotParaDiscord,
  emojiParaReacaoDiscord,
  converterConteudo,
  nomeWebhookDiscord,
  limitar
};
