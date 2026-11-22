const { emojisParaStoat } = require('./emojis');

const CONTEUDO_MAX = 2000;

function limitar(texto, maximo) {
  const valor = String(texto);
  return valor.length > maximo ? `${valor.slice(0, maximo - 1)}…` : valor;
}

function limparTexto(texto) {
  return emojisParaStoat(texto)
    .split('\n')
    .map((linha) => {
      const semEspacos = linha.replace(/[ \t]{2,}/g, ' ').replace(/^(#{1,3}) +/, '$1 ').trimEnd();
      const pequeno = /^-# (.*)$/.exec(semEspacos);
      return pequeno ? `_${pequeno[1]}_` : semEspacos;
    })
    .join('\n')
    .trim();
}

function embedParaStoat(embed) {
  const json = embed && typeof embed.toJSON === 'function' ? embed.toJSON() : (embed || {});
  const partes = [];
  if (json.title) partes.push(`### ${json.title}`);
  if (json.description) partes.push(json.description);
  for (const campo of json.fields || []) {
    partes.push(`**${campo.name}**\n${campo.value}`);
  }
  if (json.footer && json.footer.text) partes.push(`_${json.footer.text}_`);
  const resultado = { description: limitar(limparTexto(partes.join('\n\n')), CONTEUDO_MAX) };
  const cor = corHex(json.color);
  if (cor) resultado.colour = cor;
  return resultado;
}

function corpoDoTexto(conteudo) {
  const opcoes = typeof conteudo === 'string' ? { content: conteudo } : { ...(conteudo || {}) };
  return limitar(limparTexto(opcoes.content || ''), CONTEUDO_MAX);
}

function embedsDoTexto(conteudo) {
  const embeds = conteudo && typeof conteudo === 'object' ? conteudo.embeds : null;
  return Array.isArray(embeds) ? embeds.slice(0, 10).map(embedParaStoat) : [];
}

function corHex(numero) {
  const valor = Number(numero);
  if (!Number.isFinite(valor)) return null;
  return `#${Math.max(0, Math.min(0xffffff, valor)).toString(16).padStart(6, '0')}`;
}

module.exports = { CONTEUDO_MAX, limitar, limparTexto, embedParaStoat, corpoDoTexto, embedsDoTexto, corHex };
