const { COMANDOS_SLASH } = require('../../util/conversao');
const { trocarEmojis, emojiDoBotao } = require('./emojis');

const COR = 0x0330EF;
const FLAG_COMPONENTES_V2 = 1 << 15;
const FLAG_EFEMERA = 1 << 6;
const LIMITE_TEXTO = 3900;

const ESTILOS = { primary: 1, secondary: 2, success: 3, danger: 4, link: 5 };

const COMANDO_COM_PREFIXO = /\bg\.([a-zà-ú]+)/gi;

function textoDiscord(texto) {
  const comEmojis = trocarEmojis(texto);
  return comEmojis.replace(COMANDO_COM_PREFIXO, (trecho, nome) => {
    const minusculo = nome.toLowerCase();
    return COMANDOS_SLASH.has(minusculo) ? `/${minusculo}` : trecho;
  });
}

function texto(conteudo) {
  const limpo = textoDiscord(conteudo);
  return { type: 10, content: limpo.length > LIMITE_TEXTO ? `${limpo.slice(0, LIMITE_TEXTO)}…` : limpo };
}

function separador() {
  return { type: 14, divider: true, spacing: 1 };
}

function botao({ id, rotulo, estilo = 'secondary', emoji, url, desabilitado }) {
  const componente = { type: 2, style: ESTILOS[estilo] || ESTILOS.secondary };
  if (rotulo) componente.label = rotulo;
  const emojiResolvido = emoji ? emojiDoBotao(emoji) : null;
  if (emojiResolvido) componente.emoji = emojiResolvido;
  if (url) componente.url = url;
  else componente.custom_id = id;
  if (desabilitado) componente.disabled = true;
  return componente;
}

function linhas(botoes) {
  const resultado = [];
  for (let i = 0; i < botoes.length; i += 5) {
    resultado.push({ type: 1, components: botoes.slice(i, i + 5).map(botao) });
  }
  return resultado;
}

function container(filhos, cor = COR) {
  return { type: 17, accent_color: cor, components: filhos };
}

function containerDeTexto(conteudo) {
  return container([texto(conteudo)]);
}

function containerDeEmbed(embed) {
  const json = typeof embed.toJSON === 'function' ? embed.toJSON() : { ...embed };
  const filhos = [];

  const [primeiro, ...demais] = String(json.description || '').split('\n---\n');
  const cabecalho = [json.title ? `# ${json.title}` : null, primeiro || null].filter(Boolean).join('\n');
  if (cabecalho) filhos.push(texto(cabecalho));
  for (const trecho of demais) filhos.push(separador(), texto(trecho));

  const campos = Array.isArray(json.fields) ? json.fields : [];
  if (campos.length) {
    if (cabecalho) filhos.push(separador());
    for (const campo of campos) filhos.push(texto(`**${campo.name}**\n${campo.value}`));
  }

  if (json.footer && json.footer.text) filhos.push(texto(`-# ${json.footer.text}`));
  if (filhos.length === 0) filhos.push(texto('​'));

  return container(filhos, typeof json.color === 'number' ? json.color : COR);
}

function montarComponentes({ content, embeds, botoes }) {
  const blocos = [];
  if (content) blocos.push(containerDeTexto(content));
  if (Array.isArray(embeds)) for (const embed of embeds) blocos.push(containerDeEmbed(embed));
  if (blocos.length === 0) return null;

  if (Array.isArray(botoes) && botoes.length) {
    const ultimo = blocos[blocos.length - 1];
    ultimo.components.push(separador(), ...linhas(botoes));
  }
  return blocos;
}

module.exports = {
  COR,
  FLAG_COMPONENTES_V2,
  FLAG_EFEMERA,
  textoDiscord,
  texto,
  separador,
  botao,
  linhas,
  container,
  containerDeTexto,
  containerDeEmbed,
  montarComponentes
};
