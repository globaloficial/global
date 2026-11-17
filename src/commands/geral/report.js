const { EmbedBuilder } = require('@fluxerjs/core');
const { client } = require('../../lib/client');
const { CANAL_REPORTS, COOLDOWN_REPORT } = require('../../config');
const MensagemGlobal = require('../../models/MensagemGlobal');
const { log } = require('../../util/logger');
const { PREFIXO } = require('../../config');
const { sucesso, info, erro, espera } = require('../../util/respostas');

const cooldownReports = new Map();

module.exports = {
  name: 'report',
  aliases: ['denunciar'],
  description: 'Denuncia uma mensagem do chat global (responda a ela).',

  async execute(message, args) {
    if (!CANAL_REPORTS) {
      await message.reply(info('Denúncias em manutenção', 'O sistema de denúncias ainda não está disponível, tente de novo mais tarde.'));
      return;
    }

    const refId = message.messageReference ? message.messageReference.messageId : null;
    if (!refId) {
      await message.reply(info('Responda a mensagem', `Para denunciar, **responda** (reply) à mensagem do chat global com \`${PREFIXO}report [motivo]\`.`, { abaixo: 'As denúncias são revisadas por um humano.' }));
      return;
    }

    const ultimo = cooldownReports.get(message.author.id);
    if (ultimo && Date.now() - ultimo < COOLDOWN_REPORT) {
      await message.reply(espera('Calma, tá com pressa?', 'Aguarde um pouco antes de enviar outra denúncia.'));
      return;
    }

    const r = await MensagemGlobal.findOne({ msgId: String(refId) }).lean();
    const origem = r ? await MensagemGlobal.findOne({ grupoId: r.grupoId, msgId: r.grupoId }).lean() : null;
    if (!r || !origem) {
      await message.reply(erro('Essa já ficou pra trás', 'Só consigo denunciar mensagens **recentes** do chat global, essa já passou do prazo.'));
      return;
    }
    if (origem.autorId === String(message.author.id)) {
      await message.reply(erro('Denunciar você mesmo?', 'Você não pode denunciar a própria mensagem, se foi um engano é só apagá-la.'));
      return;
    }

    const motivo = args.join(' ').slice(0, 300) || 'Não informado';

    // Se a original já foi apagada, cai para a cópia.
    let conteudo = null;
    let midia = null;
    try {
      const canalOrigem = await client.channels.fetch(origem.canalId);
      const original = await canalOrigem.messages.fetch(r.grupoId);
      conteudo = original.content || '';
      if (original.attachments && original.attachments.size > 0) midia = original.attachments.first().url;
    } catch (e) {
      try {
        const copia = await message.channel.messages.fetch(String(refId));
        conteudo = (copia.embeds && copia.embeds[0] && copia.embeds[0].description) || copia.content || '';
      } catch (_) {
        // Sem a cópia também: a denúncia segue como "(sem texto)".
      }
    }

    const guildReportada = client.guilds.get(origem.guildId);
    const guildDenunciante = message.guild;
    const nomeReportada = guildReportada && guildReportada.name ? guildReportada.name : 'Desconhecido';
    const nomeDenunciante = guildDenunciante && guildDenunciante.name ? guildDenunciante.name : 'Desconhecido';

    let trecho = conteudo ? conteudo.slice(0, 900) : '*(sem texto)*';
    if (midia) trecho += `\n${midia}`;

    try {
      /** @type {any} */
      const canal = await client.channels.fetch(CANAL_REPORTS);
      if (!canal) throw new Error('canal de denúncias não encontrado');

      const embed = new EmbedBuilder()
        .setTitle('<:information2fill:1562606683371339784> Nova denúncia')
        .setColor(0xE5484D)
        .addFields(
          { name: 'Denunciado', value: `<@${origem.autorId}> (\`${origem.autorId}\`)`, inline: true },
          { name: 'Servidor de origem', value: `${nomeReportada} (\`${origem.guildId}\`)`, inline: true },
          { name: 'Denunciante', value: `<@${message.author.id}> (\`${message.author.id}\`) em ${nomeDenunciante}`, inline: false },
          { name: 'Motivo', value: motivo, inline: false },
          { name: 'Mensagem', value: trecho, inline: false }
        )
        .setFooter({ text: `g.ban usuario ${origem.autorId}  •  msg ${r.grupoId}` });

      await canal.send({ embeds: [embed] });
      cooldownReports.set(message.author.id, Date.now());
      log.ok('REPORT', `Denúncia de ${message.author.id} contra ${origem.autorId} (msg ${r.grupoId})`);
      await message.reply(sucesso('Denúncia enviada', 'Mandei a denúncia para a equipe do Global, obrigado por ajudar a manter o chat legal!'));
    } catch (e) {
      log.error('REPORT', 'Falha ao enviar denúncia', e);
      await message.reply(erro('Deu ruim na denúncia', 'Não consegui enviar a denúncia agora, tente novamente mais tarde.'));
    }
  }
};
