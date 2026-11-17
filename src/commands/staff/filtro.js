const Palavra = require('../../models/Palavra');
const { recarregarPalavras, acharPalavraProibida, totalEntradas } = require('../../services/filtros/palavras');
const { normalizarTexto } = require('../../services/filtros/normalizacao');
const { EmbedBuilder } = require('@fluxerjs/core');
const { log } = require('../../util/logger');
const { PREFIXO } = require('../../config');
const { EMOJI, sucesso, info, erro, usoIncorreto } = require('../../util/respostas');
const { negarSeNaoStaff } = require('./_comum');

module.exports = {
  name: 'filtro',
  aliases: [],
  description: 'Gerencia o filtro de palavras.',

  async execute(message, args) {
    if (await negarSeNaoStaff(message)) return;

    const sub = (args[0] || '').toLowerCase();
    const resto = args.slice(1).join(' ');
    const palavra = normalizarTexto(resto).trim();

    if (['add', 'adicionar'].includes(sub) && palavra) {
      if (palavra.length < 2 || palavra.length > 50) {
        await message.reply(erro('Tamanho estranho', 'A palavra precisa ter entre **2 e 50** caracteres.'));
        return;
      }
      await Palavra.updateOne(
        { palavra, tipo: 'proibida' },
        { $setOnInsert: { palavra, tipo: 'proibida' } },
        { upsert: true }
      );
      await recarregarPalavras();
      log.ok('FILTRO', `Palavra adicionada por ${message.author.id}`);
      await message.reply(sucesso('Palavra adicionada', `A palavra \`${palavra}\` agora é bloqueada no Global.`));
      return;
    }

    if (['remove', 'remover', 'del'].includes(sub) && palavra) {
      const r = await Palavra.deleteOne({ palavra, tipo: 'proibida' });
      await recarregarPalavras();
      await message.reply(r.deletedCount > 0
        ? sucesso('Palavra removida', `A palavra \`${palavra}\` saiu do filtro.`)
        : info('Nada pra remover', `A palavra \`${palavra}\` não está na lista personalizada, se ela vem das listas de arquivos, use \`${PREFIXO}filtro liberar\`.`));
      return;
    }

    if (['liberar', 'permitir'].includes(sub) && palavra) {
      await Palavra.updateOne(
        { palavra, tipo: 'liberada' },
        { $setOnInsert: { palavra, tipo: 'liberada' } },
        { upsert: true }
      );
      await recarregarPalavras();
      await message.reply(sucesso('Palavra liberada', `A palavra \`${palavra}\` não será mais bloqueada.`));
      return;
    }

    if (['desliberar', 'bloquear'].includes(sub) && palavra) {
      const r = await Palavra.deleteOne({ palavra, tipo: 'liberada' });
      await recarregarPalavras();
      await message.reply(r.deletedCount > 0
        ? sucesso('Exceção removida', `A palavra \`${palavra}\` voltou a ser bloqueada.`)
        : info('Nada pra remover', `A palavra \`${palavra}\` não estava liberada.`));
      return;
    }

    if (['testar', 'test'].includes(sub) && resto) {
      const achado = acharPalavraProibida(resto);
      await message.reply(achado
        ? erro('Seria bloqueada', `O texto cai no filtro, bateu em \`${achado}\`.`, { abaixo: null })
        : sucesso('Passaria batido', 'O texto não é bloqueado pelo filtro.'));
      return;
    }

    if (['recarregar', 'reload'].includes(sub)) {
      await recarregarPalavras();
      await message.reply(sucesso('Filtro recarregado', `Recarreguei a lista de palavras, já está valendo (${totalEntradas()} entradas).`));
      return;
    }

    if (['list', 'lista', 'listar'].includes(sub)) {
      const palavras = await Palavra.find().sort({ palavra: 1 }).lean();
      const custom = palavras.filter((p) => p.tipo === 'proibida').map((p) => p.palavra);
      const excecoes = palavras.filter((p) => p.tipo === 'liberada').map((p) => p.palavra);

      if (custom.length === 0 && excecoes.length === 0) {
        await message.reply(info('Filtro limpo', 'Nenhuma palavra foi adicionada ou liberada por aqui ainda.'));
        return;
      }

      const lista = (itens) => {
        const texto = itens.map((p, i) => `**${i + 1}.** \`${p}\``).join('\n');
        return texto.length > 3800 ? `${texto.slice(0, 3800)}\n…` : texto;
      };
      const embeds = [];
      if (custom.length) {
        embeds.push(new EmbedBuilder().setColor(0x0330EF).setTitle(`${EMOJI.info} Palavras Bloqueadas`).setDescription(lista(custom)));
      }
      if (excecoes.length) {
        embeds.push(new EmbedBuilder().setColor(0x0330EF).setTitle(`${EMOJI.info} Palavras Liberadas`).setDescription(lista(excecoes)));
      }
      await message.reply({ embeds });
      return;
    }

    await message.reply(usoIncorreto(message, PREFIXO, 'Vou me acalmar pra não filtrar o dicionário inteiro.', `${PREFIXO}filtro add/remove/liberar/desliberar/testar/recarregar/list (palavra)`));
  }
};
