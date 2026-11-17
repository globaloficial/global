const Guild = require('../../models/Guild');
const Bloqueio = require('../../models/Bloqueio');
const AlteracaoPainel = require('../../models/AlteracaoPainel');
const { log } = require('../../util/logger');
const pontes = require('../pontes');
const { ErroPainel } = require('./erros');
const plataformas = require('./plataformas');
const servidores = require('./servidores');

const ERROS = {
  'canal-ocupado': [409, 'Esse canal já tem uma conexão ativa. Desconecte-o antes de usá-lo numa ponte.'],
  'limite-servidor': [409, `Este servidor já participa de ${pontes.MAX_PONTES_POR_SERVIDOR} pontes, que é o limite.`],
  'codigo-invalido': [404, 'Não achei nenhuma ponte com esse código. Confira se digitou certinho.'],
  'servidor-ja-esta': [409, 'Este servidor já participa dessa ponte.'],
  'ponte-cheia': [409, `Essa ponte já tem ${pontes.MAX_PARTICIPANTES} servidores, que é o limite.`],
  'nao-participa': [404, 'Esse servidor não participa da ponte.']
};

function falhar(codigo) {
  const [status, mensagem] = ERROS[codigo] || [400, 'Não foi possível concluir a ação.'];
  throw new ErroPainel(status, mensagem);
}

async function registrar(usuario, plataforma, guildId, campo, de, para) {
  await AlteracaoPainel.create({
    guildId: String(guildId),
    plataforma,
    userId: usuario.id,
    userNome: usuario.nome,
    userPlataforma: usuario.plataforma,
    campo,
    de: de ?? null,
    para: para ?? null
  });
  log.ok('PAINEL', `${usuario.nome} (${usuario.plataforma}:${usuario.id}) ${campo} em ${plataforma}:${guildId}`);
}

function nomeDaPonte(ponte) {
  return ponte.nome || 'Ponte sem nome';
}

function visaoDaPonte(ponte, guildId, canais) {
  return {
    codigo: ponte.codigo,
    nome: nomeDaPonte(ponte),
    souDono: ponte.donoGuildId === guildId,
    criadoEm: ponte.criadoEm,
    participantes: ponte.participantes.map((p) => {
      const meu = p.guildId === guildId;
      const canal = meu ? canais.find((c) => c.id === p.canalId) : null;

      return {
        guildId: p.guildId,
        plataforma: p.plataforma || 'fluxer',
        nomeServidor: p.nomeServidor || `Servidor ${p.guildId}`,
        pausado: Boolean(p.pausado),
        dono: p.guildId === ponte.donoGuildId,
        eu: meu,
        canalNome: canal ? canal.nome : null
      };
    })
  };
}

async function canaisLivres(canais) {
  const todas = await pontes.carregarPontes();
  const emPonte = new Set();

  for (const ponte of todas.values()) {
    for (const p of ponte.participantes) emPonte.add(p.canalId);
  }

  const ids = canais.map((c) => c.id);
  const emGlobal = new Set(await Guild.find({ canalId: { $in: ids } }).distinct('canalId'));

  return canais.filter((c) => !c.nsfw && !emPonte.has(c.id) && !emGlobal.has(c.id));
}

async function listar(usuario, plataforma, guildId) {
  const { guild } = await servidores.abrirServidor(usuario, plataforma, guildId);
  const gId = String(guild.id);
  const canais = await plataformas.listarCanais(plataforma, guild);
  const lista = await pontes.pontesDoServidor(gId);

  return {
    pontes: lista
      .map((ponte) => visaoDaPonte(ponte, gId, canais))
      .sort((a, b) => b.criadoEm - a.criadoEm),
    canaisLivres: await canaisLivres(canais),
    adulto: plataformas.servidorAdulto(guild),
    limites: { participantes: pontes.MAX_PARTICIPANTES, pontes: pontes.MAX_PONTES_POR_SERVIDOR }
  };
}

async function exigirNaoBloqueado(guildId) {
  if (await Bloqueio.exists({ tipo: 'servidor', id: String(guildId) })) {
    throw new ErroPainel(403, 'Este servidor está bloqueado do Global');
  }
}

function nomeLimpo(valor) {
  return String(valor || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

async function criar(usuario, plataforma, guildId, corpo) {
  const { guild } = await servidores.abrirServidor(usuario, plataforma, guildId);
  const gId = String(guild.id);

  await exigirNaoBloqueado(gId);
  await servidores.validarCanalDeTexto(plataforma, guild, corpo.canalId);

  const resultado = await pontes.criarPonte({
    nome: nomeLimpo(corpo.nome) || `Ponte Privada de ${guild.name || 'Servidor'}`,
    donoId: usuario.id,
    guildId: gId,
    plataforma,
    canalId: String(corpo.canalId),
    nomeServidor: guild.name || null
  });
  if (resultado.erro) falhar(resultado.erro);

  await registrar(usuario, plataforma, gId, 'ponte:criar', null, resultado.ponte.codigo);
  return listar(usuario, plataforma, guildId);
}

async function entrar(usuario, plataforma, guildId, corpo) {
  const { guild } = await servidores.abrirServidor(usuario, plataforma, guildId);
  const gId = String(guild.id);

  await exigirNaoBloqueado(gId);
  await servidores.validarCanalDeTexto(plataforma, guild, corpo.canalId);

  const resultado = await pontes.entrarNaPonte(corpo.codigo, {
    guildId: gId,
    plataforma,
    canalId: String(corpo.canalId),
    nomeServidor: guild.name || null
  });
  if (resultado.erro) falhar(resultado.erro);

  await registrar(usuario, plataforma, gId, 'ponte:entrar', null, resultado.ponte.codigo);
  return listar(usuario, plataforma, guildId);
}

async function obterPonte(gId, codigo) {
  const ponte = await pontes.pontePorCodigo(codigo);
  if (!ponte || !ponte.participantes.some((p) => p.guildId === gId)) {
    throw new ErroPainel(404, 'Ponte não encontrada neste servidor');
  }
  return ponte;
}

function exigirDono(ponte, gId) {
  if (ponte.donoGuildId !== gId) throw new ErroPainel(403, 'Só o servidor que criou a ponte pode fazer isso');
}

async function alterar(usuario, plataforma, guildId, codigo, corpo) {
  const { guild } = await servidores.abrirServidor(usuario, plataforma, guildId);
  const gId = String(guild.id);
  const ponte = await obterPonte(gId, codigo);
  let alterou = false;

  if ('nome' in corpo) {
    exigirDono(ponte, gId);
    const nome = nomeLimpo(corpo.nome);
    if (!nome) throw new ErroPainel(400, 'Dê um nome para a ponte');

    if (nome !== nomeDaPonte(ponte)) {
      await pontes.renomearPonte(ponte, nome);
      await registrar(usuario, plataforma, gId, 'ponte:renomear', nomeDaPonte(ponte), nome);
      alterou = true;
    }
  }

  if ('pausado' in corpo) {
    if (typeof corpo.pausado !== 'boolean') throw new ErroPainel(400, 'Valor inválido para pausado');
    const atual = Boolean(ponte.participantes.find((p) => p.guildId === gId).pausado);

    if (corpo.pausado !== atual) {
      await pontes.definirPausaDoParticipante(ponte.codigo, gId, corpo.pausado);
      await registrar(usuario, plataforma, gId, 'ponte:pausa', atual, corpo.pausado);
      alterou = true;
    }
  }

  if (!alterou && !('nome' in corpo) && !('pausado' in corpo)) throw new ErroPainel(400, 'Nenhuma alteração enviada');
  return listar(usuario, plataforma, guildId);
}

async function removerParticipante(usuario, plataforma, guildId, codigo, alvo) {
  const { guild } = await servidores.abrirServidor(usuario, plataforma, guildId);
  const gId = String(guild.id);
  const ponte = await obterPonte(gId, codigo);
  const alvoId = String(alvo);
  const saindo = alvoId === gId;

  if (!saindo) exigirDono(ponte, gId);

  const participante = ponte.participantes.find((p) => p.guildId === alvoId);
  const resultado = await pontes.removerParticipante(ponte, alvoId);
  if (resultado.erro) falhar(resultado.erro);

  const nomeAlvo = participante ? (participante.nomeServidor || alvoId) : alvoId;

  if (saindo) {
    await registrar(usuario, plataforma, gId, 'ponte:sair', null, nomeDaPonte(ponte));
  } else {
    await registrar(usuario, plataforma, gId, 'ponte:remover', null, nomeAlvo);
    await registrar(usuario, participante && participante.plataforma, alvoId, 'ponte:removido', null, nomeDaPonte(ponte));
  }

  return listar(usuario, plataforma, guildId);
}

async function encerrar(usuario, plataforma, guildId, codigo) {
  const { guild } = await servidores.abrirServidor(usuario, plataforma, guildId);
  const gId = String(guild.id);
  const ponte = await obterPonte(gId, codigo);

  exigirDono(ponte, gId);
  await pontes.encerrarPonte(ponte);

  await registrar(usuario, plataforma, gId, 'ponte:encerrar', null, nomeDaPonte(ponte));
  for (const p of ponte.participantes.filter((x) => x.guildId !== gId)) {
    await registrar(usuario, p.plataforma, p.guildId, 'ponte:removido', null, nomeDaPonte(ponte));
  }

  return listar(usuario, plataforma, guildId);
}

module.exports = { listar, criar, entrar, alterar, removerParticipante, encerrar };
