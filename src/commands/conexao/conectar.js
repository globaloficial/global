const Guild = require('../../models/Guild');
const { limparFalhasDestino } = require('../../services/destinos');
const { idDoServidor } = require('../../util/ids');
const { log, descreverContexto } = require('../../util/logger');
const { temPermissaoConfig } = require('../../services/permissoes');
const { origemAdulta } = require('../../services/filtros/adulto');
const { pontePorCanal } = require('../../services/pontes');
const { sucesso, erro, SEM_PERMISSAO } = require('../../util/respostas');

module.exports = {
  name: 'conectar',
  aliases: ['connect'],
  description: 'Define o canal atual como a conexão do chat global.',

  async execute(message) {
    const guildId = idDoServidor(message);
    if (!guildId) return;

    if (!(await temPermissaoConfig(message))) {
      log.warn('CONECTAR', `Permissão negada para ${descreverContexto(message)}`);
      await message.reply(SEM_PERMISSAO.canais);
      return;
    }

    const canalId = String(message.channel.id);

    if (origemAdulta(message)) {
      log.warn('CONECTAR', `Canal 18+ recusado | ${descreverContexto(message)}`);
      await message.reply(erro(
        'Erro ao conectar',
        `Não pude conectar este canal (<#${canalId}>) pois o mesmo é um canal \`+18\` e isto vai contra a nossa [Política de Privacidade](https://docs.globalbot.site/politicas).`
      ));
      return;
    }

    const gId = String(guildId);
    const atual = await Guild.findOne({ guildId: gId, canalId: { $ne: null } }).lean();
    const ponte = await pontePorCanal(canalId);
    if (ponte || (atual && atual.canalId === canalId)) {
      await message.reply(erro(
        'Erro ao conectar',
        `Não pude conectar este canal (<#${canalId}>) pois ele já tem uma conexão ativa, remova a **${ponte ? 'Conexão Privada' : 'Conexão Global'}** ou configure-a para outro canal, ou tente de novo essa mensagem em outro canal sem nenhuma conexão ativa.`
      ));
      return;
    }

    await Guild.findOneAndUpdate(
      { guildId: gId },
      { canalId, plataforma: message.plataforma || 'fluxer' },
      { upsert: true }
    );
    limparFalhasDestino(gId);
    log.ok('CONECTAR', `Canal global ${atual ? `alterado (${atual.canalId} -> ${canalId})` : `definido (${canalId})`} | ${descreverContexto(message)}`);

    await message.reply(sucesso(
      'Conectado com sucesso',
      `Conectei com sucesso á **Conexão Global** (<#${canalId}>), em alguns minutos as mensagens desta conexão começarão a ser exibidas.`,
      { abaixo: '**Dica:** Troque o modo de mensagens para Webhook para conversas mais naturais.' }
    ));
  }
};
