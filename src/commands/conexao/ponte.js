const { PREFIXO } = require('../../config');
const { EMOJI, sucesso, info, erro, erroSimples, SEM_PERMISSAO } = require('../../util/respostas');
const { idDoServidor } = require('../../util/ids');
const { log, descreverContexto } = require('../../util/logger');
const { temPermissaoConfig } = require('../../services/permissoes');
const { origemAdulta } = require('../../services/filtros/adulto');
const {
  MAX_PARTICIPANTES,
  MAX_PONTES_POR_SERVIDOR,
  pontePorCodigo,
  pontePorCanal,
  pontesDoServidor,
  criarPonte,
  entrarNaPonte,
  removerParticipante,
  encerrarPonte
} = require('../../services/pontes');

const ROTULO_PLATAFORMA = { fluxer: 'Fluxer', discord: 'Discord', stoat: 'Stoat' };

const ERROS = {
  'canal-ocupado': (canalId) => erro('Canal ocupado', `O canal <#${canalId}> já tem uma conexão ativa, use \`${PREFIXO}desconectar\` antes de entrar numa ponte.`),
  'limite-servidor': () => erro('Limite de pontes', `Este servidor já participa de **${MAX_PONTES_POR_SERVIDOR}** pontes, que é o limite.`),
  'codigo-invalido': (_, codigo) => erro('Código inválido', `Não achei nenhuma ponte com o código \`${codigo}\`, confere se digitou certinho.`),
  'servidor-ja-esta': () => erro('Já está por aqui', 'Este servidor já participa dessa ponte.'),
  'ponte-cheia': () => erro('Ponte cheia', `Esta ponte já tem **${MAX_PARTICIPANTES} servidores**, é o limite. Peça pra alguém sair, ou crie outra.`)
};

function nomeDoServidor(message) {
  return message.guild && message.guild.name ? String(message.guild.name) : null;
}

function nomeDaPonte(ponte) {
  return ponte.nome || 'Ponte sem nome';
}

function descreverParticipante(p) {
  const nome = p.nomeServidor || p.guildId;
  return `${nome} (${ROTULO_PLATAFORMA[p.plataforma] || p.plataforma}) em <#${p.canalId}>`;
}

function ajuda() {
  return [
    `# ${EMOJI.privado} Pontes privadas`,
    'Ligue canais de servidores amigos, do Fluxer, do Discord ou do Stoat, sem passar pelo chat global.',
    '',
    `**Criar:** \`${PREFIXO}ponte criar [nome]\``,
    `**Entrar:** \`${PREFIXO}ponte entrar <código>\``,
    `**Listar:** \`${PREFIXO}ponte listar\``,
    `**Sair:** \`${PREFIXO}ponte sair\``,
    `**Remover:** \`${PREFIXO}ponte remover <código> <id do servidor>\``,
    `**Encerrar:** \`${PREFIXO}ponte encerrar <código>\``,
    `-# Até ${MAX_PARTICIPANTES} servidores por ponte. Um canal não fica no global e numa ponte ao mesmo tempo.`
  ].join('\n');
}

module.exports = {
  name: 'ponte',
  aliases: ['bridge', 'pontes'],
  description: 'Cria e gerencia pontes privadas entre canais.',

  async execute(message, args = []) {
    const guildId = idDoServidor(message);
    if (!guildId) return;

    if (!(await temPermissaoConfig(message))) {
      log.warn('PONTE', `Permissão negada para ${descreverContexto(message)}`);
      await message.reply(SEM_PERMISSAO.canais);
      return;
    }

    const sub = (args[0] || '').toLowerCase();
    const gId = String(guildId);

    if (sub === 'criar') return this.criar(message, gId, args.slice(1).join(' '));
    if (sub === 'entrar') return this.entrar(message, gId, args[1]);
    if (sub === 'sair') return this.sair(message, gId);
    if (sub === 'listar') return this.listar(message, gId);
    if (sub === 'remover') return this.remover(message, gId, args[1], args[2]);
    if (sub === 'encerrar') return this.encerrar(message, gId, args[1]);

    if (message.plataforma === 'discord') {
      const dono = message.author.id;
      await message.reply({
        content: ajuda(),
        botoes: [
          { id: `cmd|${dono}|ponte|criar`, rotulo: 'Criar', estilo: 'primary', emoji: EMOJI.mundo },
          { id: `modal-abrir|${dono}|entrar`, rotulo: 'Entrar', emoji: EMOJI.privado },
          { id: `cmd|${dono}|ponte|listar`, rotulo: 'Listar', emoji: EMOJI.janela },
          { id: `cmd|${dono}|ponte|sair`, rotulo: 'Sair', estilo: 'danger', emoji: EMOJI.desligado }
        ]
      });
      return;
    }
    await message.reply(ajuda());
  },

  dadosDoCanal(message, gId) {
    return {
      guildId: gId,
      plataforma: message.plataforma || 'fluxer',
      canalId: String(message.channel.id),
      nomeServidor: nomeDoServidor(message)
    };
  },

  async recusarCanalAdulto(message) {
    if (!origemAdulta(message)) return false;
    await message.reply(erro('Canal +18', `Canais **+18** não podem entrar em pontes, isso vai contra a nossa [Política de Privacidade](https://docs.globalbot.site/politicas).`));
    return true;
  },

  async criar(message, gId, nome) {
    if (await this.recusarCanalAdulto(message)) return;

    const nomePadrao = `Ponte Privada de ${nomeDoServidor(message) || 'Servidor'}`;
    const r = await criarPonte({ nome: nome || nomePadrao, donoId: message.author.id, ...this.dadosDoCanal(message, gId) });
    if (r.erro) {
      await message.reply(ERROS[r.erro](message.channel.id));
      return;
    }

    log.ok('PONTE', `Criada ${r.ponte.codigo} | ${descreverContexto(message)}`);
    await message.reply(sucesso(
      'Ponte criada com sucesso',
      `Criei a **${nomeDaPonte(r.ponte)}** com o canal <#${message.channel.id}>. Para chamar os amigos, mande o código \`${r.ponte.codigo}\` e peça pra usarem \`${PREFIXO}ponte entrar ${r.ponte.codigo}\`.`,
      { abaixo: 'Só quem tem Gerenciar Canais consegue entrar. Compartilhe o código só com quem você confia.' }
    ));
  },

  async entrar(message, gId, codigo) {
    if (!codigo) {
      await message.reply(erroSimples('Faltou o código', `O uso correto deste comando seria \`${PREFIXO}ponte entrar <código>\`.`));
      return;
    }
    if (await this.recusarCanalAdulto(message)) return;

    const r = await entrarNaPonte(codigo, this.dadosDoCanal(message, gId));
    if (r.erro) {
      await message.reply(ERROS[r.erro](message.channel.id, codigo));
      return;
    }

    log.ok('PONTE', `Entrou em ${r.ponte.codigo} | ${descreverContexto(message)}`);
    await message.reply(sucesso(
      'Entrou na ponte',
      `O canal <#${message.channel.id}> agora faz parte da **${nomeDaPonte(r.ponte)}**, que tem ${r.ponte.participantes.length} servidor(es). Tudo que for escrito aqui aparece nos outros canais da ponte, e o contrário também.`
    ));
  },

  async sair(message, gId) {
    const ponte = await pontePorCanal(message.channel.id);
    if (!ponte || !ponte.participantes.some((p) => p.guildId === gId && p.canalId === String(message.channel.id))) {
      await message.reply(erroSimples('Eu vou sair do vento?', `Este canal não faz parte de nenhuma ponte, utilize \`${PREFIXO}ponte\` para ver como criar uma.`));
      return;
    }

    await removerParticipante(ponte, gId);
    log.ok('PONTE', `Saiu de ${ponte.codigo} | ${descreverContexto(message)}`);
    await message.reply(sucesso(
      'Saiu da ponte',
      `Tirei o canal <#${message.channel.id}> da **${nomeDaPonte(ponte)}**, agora ele não envia nem recebe mais mensagens dela.`
    ));
  },

  async listar(message, gId) {
    const pontes = await pontesDoServidor(gId);
    if (pontes.length === 0) {
      await message.reply(info('Nada por aqui', `Este servidor ainda não tem ponte, que tal criar uma com \`${PREFIXO}ponte criar\`?`));
      return;
    }

    const blocos = pontes.map((p) => {
      const titulo = `**${nomeDaPonte(p)}** · \`${p.codigo}\`${p.donoGuildId === gId ? ' · você é o dono' : ''}`;
      return `${titulo}\n${p.participantes.map((x) => `- ${descreverParticipante(x)}`).join('\n')}`;
    });
    await message.reply(`# ${EMOJI.mundo} Pontes deste servidor\n${blocos.join('\n\n')}`);
  },

  async carregarPonteDoDono(message, gId, codigo) {
    if (!codigo) {
      await message.reply(erroSimples('Faltou o código', `Informe o código da ponte, veja os códigos com \`${PREFIXO}ponte listar\`.`));
      return null;
    }
    const ponte = await pontePorCodigo(codigo);
    if (!ponte || !ponte.participantes.some((p) => p.guildId === gId)) {
      await message.reply(erro('Ponte não encontrada', `Não achei nenhuma ponte com o código \`${codigo}\` neste servidor, confere se digitou certinho.`));
      return null;
    }
    if (ponte.donoGuildId !== gId) {
      await message.reply(erro('Só o dono da ponte', 'Só o servidor que criou a ponte pode fazer isso.'));
      return null;
    }
    return ponte;
  },

  async remover(message, gId, codigo, alvo) {
    const ponte = await this.carregarPonteDoDono(message, gId, codigo);
    if (!ponte) return;

    if (!alvo || alvo === gId) {
      await message.reply(erroSimples('Faltou o servidor', `Informe o ID de outro servidor da ponte, use \`${PREFIXO}ponte listar\` para ver a lista.`));
      return;
    }

    const r = await removerParticipante(ponte, alvo);
    if (r.erro) {
      await message.reply(erro('Servidor não encontrado', 'Esse servidor não participa da ponte.'));
      return;
    }
    log.ok('PONTE', `Servidor ${alvo} removido de ${ponte.codigo} | ${descreverContexto(message)}`);
    await message.reply(sucesso('Servidor removido', `O servidor \`${alvo}\` foi tirado da **${nomeDaPonte(ponte)}**.`));
  },

  async encerrar(message, gId, codigo) {
    const ponte = await this.carregarPonteDoDono(message, gId, codigo);
    if (!ponte) return;

    await encerrarPonte(ponte);
    await message.reply(sucesso('Ponte encerrada', `Apaguei a **${nomeDaPonte(ponte)}** e todos os canais foram desligados dela.`));
  }
};
