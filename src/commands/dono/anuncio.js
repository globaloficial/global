const { COR_PADRAO_ANUNCIO, ehDev, PREFIXO } = require('../../config');
const { desativarAnuncio, agendarAnuncio, enviarAnuncioParaTodos } = require('../../services/anuncio');
const { log, descreverContexto } = require('../../util/logger');
const { sucesso, erro, SEM_PERMISSAO, usoIncorreto } = require('../../util/respostas');

function tokenizarAnuncio(texto) {
  const tokens = [];
  const regex = /["“”]([^"“”]*)["“”]|(\S+)/g;
  let m;
  while ((m = regex.exec(texto)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

module.exports = {
  name: 'anuncio',
  aliases: [],
  description: 'Cria ou agenda um anúncio global.',

  async execute(message) {
    if (!ehDev(message.author.id)) {
      log.warn('ANUNCIO', `Acesso negado para ${descreverContexto(message)}`);
      await message.reply(SEM_PERMISSAO.dono);
      return;
    }

    const bruto = (message.content || '').trim().slice(PREFIXO.length).trim().replace(/^\S+\s*/, '');
    const tokens = tokenizarAnuncio(bruto);

    if (tokens.length === 1 && ['parar', 'off', 'desativar'].includes(tokens[0].toLowerCase())) {
      await desativarAnuncio();
      log.ok('ANUNCIO', 'Anúncio automático desativado');
      await message.reply(sucesso('Anúncio desativado', 'O anúncio automático foi desligado.'));
      return;
    }

    if (tokens.length !== 6) {
      await message.reply(usoIncorreto(
        message,
        PREFIXO,
        'Vou me acalmar pra não anunciar o nada.',
        `${PREFIXO}anuncio "título" "descrição" #hex "autor" "footer" <mensagens>`
      ) + `\n-# Use # em um campo para deixá-lo vazio. Em <mensagens>, # envia agora e um número envia a cada N mensagens. ${PREFIXO}anuncio parar desativa.`);
      return;
    }

    const [tituloRaw, descRaw, hexRaw, autorRaw, footerRaw, duracaoRaw] = tokens;
    const limpar = (v) => (v.trim() === '#' ? null : v.trim());

    const titulo = limpar(tituloRaw);
    const descricao = limpar(descRaw) ? limpar(descRaw).replace(/\\n/g, '\n') : null;
    const autor = limpar(autorRaw);
    const footer = limpar(footerRaw);

    if (!titulo && !descricao && !autor && !footer) {
      await message.reply(erro('Anúncio vazio', 'O anúncio precisa ter pelo menos um texto: título, descrição, autor ou rodapé.'));
      return;
    }

    let cor = COR_PADRAO_ANUNCIO;
    if (hexRaw.trim() !== '#') {
      const hexStr = hexRaw.trim().replace('#', '');
      if (!/^[0-9a-fA-F]{6}$/.test(hexStr)) {
        await message.reply(erro('Essa cor não existe', 'Use um HEX com 6 dígitos, como `#0330ef`, ou `#` para a cor padrão.'));
        return;
      }
      cor = parseInt(hexStr, 16);
    }

    let intervalo = 0;
    const imediato = duracaoRaw.trim() === '#';
    if (!imediato) {
      if (!/^\d+$/.test(duracaoRaw.trim()) || parseInt(duracaoRaw.trim(), 10) < 1) {
        await message.reply(erro('Esse número não serve', 'A quantidade de mensagens precisa ser maior que 0, ou `#` para enviar agora.'));
        return;
      }
      intervalo = parseInt(duracaoRaw.trim(), 10);
    }

    const anuncio = { titulo, descricao, cor, autor, footer };

    if (imediato) {
      const enviados = await enviarAnuncioParaTodos(anuncio);
      await message.reply(sucesso('Anúncio enviado', `Mandei o anúncio para **${enviados}** comunidades.`));
      return;
    }

    await agendarAnuncio(anuncio, intervalo);
    log.ok('ANUNCIO', `Anúncio automático salvo (a cada ${intervalo} mensagens)`);
    await message.reply(sucesso('Anúncio agendado', `Ele será enviado a cada **${intervalo}** mensagens do chat global, use \`${PREFIXO}anuncio parar\` para desligar.`));
  }
};
