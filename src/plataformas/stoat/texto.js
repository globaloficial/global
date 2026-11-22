const CONTEUDO_MAX = 2000;
const EMOJI_PERSONALIZADO = /<a?:[\w~]+:\d+>/g;

function limitar(texto, maximo) {
  const valor = String(texto);
  return valor.length > maximo ? `${valor.slice(0, maximo - 1)}…` : valor;
}

function limparTexto(texto) {
  return String(texto || '')
    .replace(EMOJI_PERSONALIZADO, '')
    .split('\n')
    .map((linha) => {
      const semEspacos = linha.replace(/[ \t]{2,}/g, ' ').replace(/^(#{1,3}) +/, '$1 ').trimEnd();
      const pequeno = /^-# (.*)$/.exec(semEspacos);
      return pequeno ? `_${pequeno[1]}_` : semEspacos;
    })
    .join('\n')
    .trim();
}

function embedParaTexto(embed) {
  const json = embed && typeof embed.toJSON === 'function' ? embed.toJSON() : (embed || {});
  const partes = [];
  if (json.title) partes.push(`### ${json.title}`);
  if (json.description) partes.push(json.description);
  for (const campo of json.fields || []) {
    partes.push(`**${campo.name}**\n${campo.value}`);
  }
  if (json.footer && json.footer.text) partes.push(`_${json.footer.text}_`);
  return partes.join('\n\n');
}

function corpoDoTexto(conteudo) {
  const opcoes = typeof conteudo === 'string' ? { content: conteudo } : { ...(conteudo || {}) };
  const partes = [];
  if (opcoes.content) partes.push(opcoes.content);
  if (Array.isArray(opcoes.embeds)) {
    for (const embed of opcoes.embeds) partes.push(embedParaTexto(embed));
  }
  return limitar(limparTexto(partes.filter(Boolean).join('\n\n')), CONTEUDO_MAX);
}

function corHex(numero) {
  const valor = Number(numero);
  if (!Number.isFinite(valor)) return null;
  return `#${Math.max(0, Math.min(0xffffff, valor)).toString(16).padStart(6, '0')}`;
}

module.exports = { CONTEUDO_MAX, limitar, limparTexto, embedParaTexto, corpoDoTexto, corHex };
