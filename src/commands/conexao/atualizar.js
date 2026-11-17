const Guild = require('../../models/Guild');
const { MODO_ENVIO, PREFIXO } = require('../../config');
const { log, descreverContexto } = require('../../util/logger');
const { temPermissaoConfig } = require('../../services/permissoes');
const { conexaoDoCanal } = require('../../services/conexoes');
const { participanteDoCanal } = require('../../services/pontes');
const { registrarSucessoDestino } = require('../../services/destinos');
const { sucesso, info, erro, erroSimples, SEM_PERMISSAO } = require('../../util/respostas');

const ESPERA_MS = 5000;
const ultimasTentativas = new Map();

function gerenciadorDaPlataforma(message) {
  if (message.plataforma === 'discord') return require('../../plataformas/discord/webhooks');
  return require('../../services/webhooks');
}

async function destinoDaConexao(conexao) {
  if (conexao.tipo === 'global') {
    const g = await Guild.findOne({ guildId: conexao.guildId, canalId: conexao.canalId })
      .select('+webhookToken')
      .lean();
    return {
      destino: {
        guildId: conexao.guildId,
        canalId: conexao.canalId,
        webhookId: g && g.webhookId,
        webhookToken: g && g.webhookToken,
        webhookCanalId: g && g.webhookCanalId
      },
      modo: (g && g.modoEnvio) || MODO_ENVIO
    };
  }

  const participante = participanteDoCanal(conexao.ponte, conexao.canalId);
  const g = await Guild.findOne({ guildId: conexao.guildId }).lean();
  return {
    destino: {
      guildId: conexao.guildId,
      canalId: conexao.canalId,
      ponteId: conexao.ponte.codigo,
      webhookId: participante && participante.webhookId,
      webhookToken: participante && participante.webhookToken,
      webhookCanalId: participante && participante.webhookCanalId
    },
    modo: (g && g.modoEnvio) || MODO_ENVIO
  };
}

module.exports = {
  name: 'atualizar',
  aliases: ['refresh', 'tentar'],
  description: 'Tenta de novo criar o webhook do canal depois de ajustar as permissões.',

  async execute(message) {
    if (!message.channel) return;

    if (!(await temPermissaoConfig(message))) {
      log.warn('ATUALIZAR', `Permissão negada para ${descreverContexto(message)}`);
      await message.reply(SEM_PERMISSAO.canais);
      return;
    }

    const conexao = await conexaoDoCanal(message);
    if (!conexao) {
      await message.reply(erroSimples(
        'Eu vou atualizar o vento?',
        `Não há **nenhuma** conexão ativa neste canal (<#${message.channel.id}>), utilize o comando \`${PREFIXO}conectar\` para se juntar à **Conexão Global** ou utilize \`${PREFIXO}ponte\` para criar uma conexão própria.`
      ));
      return;
    }

    const chave = `${message.plataforma || 'fluxer'}:${conexao.canalId}`;
    const restante = ESPERA_MS - (Date.now() - (ultimasTentativas.get(chave) || 0));
    if (restante > 0) {
      await message.reply(erroSimples(
        'Calma aí',
        `Você acabou de tentar, espere mais **${Math.ceil(restante / 1000)}s** e utilize \`${PREFIXO}atualizar\` de novo.`
      ));
      return;
    }
    ultimasTentativas.set(chave, Date.now());

    const { destino, modo } = await destinoDaConexao(conexao);

    if (modo !== 'webhook') {
      await message.reply(info(
        'Nada para atualizar',
        `A **${conexao.nome}** está enviando as mensagens por **embed**, que não precisa de webhook, então não há o que tentar de novo.`,
        { abaixo: `Para trocar o modo de envio, utilize \`${PREFIXO}config\`.` }
      ));
      return;
    }

    const resultado = await gerenciadorDaPlataforma(message).verificarWebhook(destino);

    if (resultado.ok) {
      if (conexao.tipo === 'global') registrarSucessoDestino(conexao.guildId);
      log.ok('ATUALIZAR', descreverContexto(message));
      await message.reply(sucesso(
        'Webhook funcionando',
        `Consegui criar o webhook neste canal, a **${conexao.nome}** voltou a entregar as mensagens normalmente.`,
        { acima: 'Deu certo!' }
      ));
      return;
    }

    if (resultado.limite) {
      await message.reply(erroSimples(
        'Muitas tentativas',
        'O limite de requisições foi atingido agora há pouco, espere alguns segundos e tente de novo.'
      ));
      return;
    }

    log.warn('ATUALIZAR', `Webhook ainda indisponível | ${descreverContexto(message)}`);
    await message.reply(erro(
      'Ainda sem permissão',
      `Ainda não consegui criar o webhook neste canal, dê a permissão **Gerenciar Webhooks** ao Global em <#${message.channel.id}> e utilize \`${PREFIXO}atualizar\` de novo.`
    ));
  }
};
