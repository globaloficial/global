const { client } = require('../lib/client');
const { discordClient } = require('../lib/discordClient');
const Guild = require('../models/Guild');
const Bloqueio = require('../models/Bloqueio');
const MensagemGlobal = require('../models/MensagemGlobal');
const { SOMENTE_ORIGEM } = require('./perfilDados');
const { obterIconeServidor } = require('./chat/mensagem');
const { obterPlataforma, nomeDoServidor } = require('../plataformas');

const FUSO_HORARIO = 'America/Sao_Paulo';
const DESLOCAMENTO_FUSO = '-03:00';
const TAMANHO_RANKING = 3;
const VALIDADE_CACHE_MS = 60_000;

let cache = { dados: null, geradoEm: 0 };

function inicioDoDia() {
  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_HORARIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  return new Date(`${hoje}T00:00:00${DESLOCAMENTO_FUSO}`).getTime();
}

const ROTULO_DISCORD = ' (Discord)';
const ROTULO_STOAT = ' (Stoat)';

async function rankingPor(campo, excluidos) {
  return MensagemGlobal.aggregate([
    { $match: { ...SOMENTE_ORIGEM, [campo]: { $nin: excluidos } } },
    { $group: { _id: { id: `$${campo}`, plataforma: '$plataforma' }, mensagens: { $sum: 1 } } },
    { $sort: { mensagens: -1, '_id.id': 1 } },
    { $limit: TAMANHO_RANKING }
  ]);
}

async function descreverUsuario({ _id, mensagens }) {
  if (_id.plataforma === 'stoat') {
    try {
      const usuario = await obterPlataforma('stoat').buscarUsuario(_id.id);
      return {
        nome: `${usuario.globalName || usuario.username}${ROTULO_STOAT}`,
        avatar: usuario.displayAvatarURL(),
        plataforma: 'stoat',
        mensagens
      };
    } catch {
      return { nome: `Usuário desconhecido${ROTULO_STOAT}`, avatar: null, plataforma: 'stoat', mensagens };
    }
  }
  const doDiscord = _id.plataforma === 'discord';
  const plataforma = doDiscord ? 'discord' : 'fluxer';
  try {
    const usuario = await (doDiscord ? discordClient : client).users.fetch(_id.id);
    return {
      nome: `${usuario.globalName || usuario.username}${doDiscord ? ROTULO_DISCORD : ''}`,
      avatar: usuario.displayAvatarURL({ size: 128, extension: 'png' }),
      plataforma,
      mensagens
    };
  } catch {
    return { nome: `Usuário desconhecido${doDiscord ? ROTULO_DISCORD : ''}`, avatar: null, plataforma, mensagens };
  }
}

function iconeDoDiscord(servidor) {
  if (!servidor) return null;
  if (servidor.icon) {
    const extensao = String(servidor.icon).startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/icons/${servidor.id}/${servidor.icon}.${extensao}?size=128`;
  }
  return obterIconeServidor(servidor);
}

function descreverServidor({ _id, mensagens }) {
  if (_id.plataforma === 'stoat') {
    const nome = nomeDoServidor(_id.id, 'stoat');
    return { nome: `${nome || 'Servidor desconhecido'}${ROTULO_STOAT}`, icone: null, plataforma: 'stoat', mensagens };
  }

  if (_id.plataforma === 'discord') {
    const servidor = discordClient.guilds.cache.get(_id.id);
    return {
      nome: `${servidor ? servidor.name : 'Servidor desconhecido'}${ROTULO_DISCORD}`,
      icone: iconeDoDiscord(servidor),
      plataforma: 'discord',
      mensagens
    };
  }

  const servidor = client.guilds.get(_id.id);
  return {
    nome: servidor?.name ?? 'Servidor desconhecido',
    icone: obterIconeServidor(servidor),
    plataforma: 'fluxer',
    mensagens
  };
}

async function contarUsuariosAtivos() {
  const [resultado] = await MensagemGlobal.aggregate([
    { $match: SOMENTE_ORIGEM },
    { $group: { _id: { id: '$autorId', plataforma: '$plataforma' } } },
    { $count: 'total' }
  ]);

  return resultado?.total ?? 0;
}

async function gerarEstatisticas() {
  const [usuariosBloqueados, servidoresBloqueados] = await Promise.all([
    Bloqueio.find({ tipo: 'usuario' }).distinct('id'),
    Bloqueio.find({ tipo: 'servidor' }).distinct('id')
  ]);

  const [mensagensHoje, mensagensHojeDiscord, servidores, servidoresDiscord, usuariosAtivos, topUsuarios, topServidores] = await Promise.all([
    MensagemGlobal.countDocuments({ ...SOMENTE_ORIGEM, criadoEm: { $gte: inicioDoDia() } }),
    MensagemGlobal.countDocuments({ ...SOMENTE_ORIGEM, plataforma: 'discord', criadoEm: { $gte: inicioDoDia() } }),
    Guild.countDocuments({ canalId: { $ne: null } }),
    Guild.countDocuments({ canalId: { $ne: null }, plataforma: 'discord' }),
    contarUsuariosAtivos(),
    rankingPor('autorId', usuariosBloqueados),
    rankingPor('guildId', servidoresBloqueados)
  ]);

  return {
    atualizadoEm: Date.now(),
    mensagensHoje,
    mensagensHojeDiscord,
    servidores,
    servidoresDiscord,
    usuariosAtivos,
    topUsuarios: await Promise.all(topUsuarios.map(descreverUsuario)),
    topServidores: topServidores.map(descreverServidor)
  };
}

async function obterEstatisticas() {
  if (cache.dados && Date.now() - cache.geradoEm < VALIDADE_CACHE_MS) return cache.dados;

  const dados = await gerarEstatisticas();
  cache = { dados, geradoEm: Date.now() };
  return dados;
}

module.exports = { obterEstatisticas };
