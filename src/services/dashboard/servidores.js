const { MODO_ENVIO } = require('../../config');
const Guild = require('../../models/Guild');
const Bloqueio = require('../../models/Bloqueio');
const AlteracaoPainel = require('../../models/AlteracaoPainel');
const { ehSnowflake } = require('../../util/ids');
const { log } = require('../../util/logger');
const { canalEstaLivre } = require('../pontes');
const { limparFalhasDestino } = require('../destinos');
const { ErroPainel } = require('./erros');
const plataformas = require('./plataformas');

const CACHE_LISTA_MS = 60_000;
const SIMULTANEOS = 8;
const COR_HEX = /^#?([0-9a-fA-F]{6})$/;

const cacheLista = new Map();

const BOOLEANOS = ['pausado', 'filtrarPalavroes', 'filtrarLinks', 'ocultarServidor', 'ocultarPerfil', 'ocultarInfoRecebida', 'mostrarIcone'];

function corParaHex(cor) {
  return typeof cor === 'number' ? `#${cor.toString(16).padStart(6, '0')}` : null;
}

function visaoDaConfig(config, bloqueado) {
  const c = config || {};

  return {
    conectado: Boolean(c.canalId),
    canalId: c.canalId || null,
    pausado: Boolean(c.pausado),
    filtrarPalavroes: c.filtrarPalavroes !== false,
    filtrarLinks: Boolean(c.filtrarLinks),
    ocultarServidor: Boolean(c.ocultarServidor),
    ocultarPerfil: Boolean(c.ocultarPerfil),
    ocultarInfoRecebida: Boolean(c.ocultarInfoRecebida),
    mostrarIcone: Boolean(c.mostrarIcone),
    modoEnvio: c.modoEnvio || MODO_ENVIO,
    webhookAtivo: Boolean(c.webhookId) && c.webhookCanalId === c.canalId,
    cor: corParaHex(c.cor),
    bloqueado: Boolean(bloqueado)
  };
}

async function emLotes(itens, tarefa) {
  const resultado = [];

  for (let i = 0; i < itens.length; i += SIMULTANEOS) {
    resultado.push(...await Promise.all(itens.slice(i, i + SIMULTANEOS).map(tarefa)));
  }

  return resultado;
}

async function listarServidores(usuario, { todos = false } = {}) {
  const chave = `${usuario.plataforma}:${usuario.id}:${todos ? 'todos' : 'meus'}`;
  const guardado = cacheLista.get(chave);
  if (guardado && guardado.expira > Date.now()) return guardado.lista;

  const candidatos = plataformas.PLATAFORMAS.flatMap((plataforma) => (
    plataformas.todasAsGuilds(plataforma).map((guild) => ({ plataforma, guild }))
  ));

  const permitidos = (await emLotes(candidatos, async ({ plataforma, guild }) => {
    if (todos) return { plataforma, guild };
    const permissoes = await plataformas.permissoesDoUsuario(plataforma, guild, usuario.id);
    return permissoes.pode ? { plataforma, guild } : null;
  })).filter(Boolean);

  const ids = permitidos.map(({ guild }) => String(guild.id));
  const [configs, bloqueados] = await Promise.all([
    Guild.find({ guildId: { $in: ids } }).lean(),
    Bloqueio.find({ tipo: 'servidor', id: { $in: ids } }).distinct('id')
  ]);

  const porId = new Map(configs.map((c) => [c.guildId, c]));
  const bloqueadosSet = new Set(bloqueados);

  const lista = permitidos
    .map(({ plataforma, guild }) => {
      const config = porId.get(String(guild.id));
      return {
        ...plataformas.resumoDoServidor(plataforma, guild),
        conectado: Boolean(config && config.canalId),
        pausado: Boolean(config && config.pausado),
        bloqueado: bloqueadosSet.has(String(guild.id))
      };
    })
    .sort((a, b) => Number(b.conectado) - Number(a.conectado) || a.nome.localeCompare(b.nome, 'pt-BR'));

  cacheLista.set(chave, { lista, expira: Date.now() + CACHE_LISTA_MS });
  return lista;
}

async function abrirServidor(usuario, plataforma, guildId) {
  if (!plataformas.PLATAFORMAS.includes(plataforma) || !ehSnowflake(String(guildId))) {
    throw new ErroPainel(400, 'Servidor inválido');
  }

  const guild = plataformas.guildDe(plataforma, guildId);
  if (!guild) throw new ErroPainel(404, 'O Global não está neste servidor');

  const permissoes = await plataformas.permissoesDoUsuario(plataforma, guild, usuario.id);
  if (!usuario.equipe && !permissoes.pode) {
    throw new ErroPainel(403, 'Você precisa de Administrador ou Gerenciar Canais neste servidor');
  }

  return { guild, permissoes };
}

async function detalhesDoServidor(usuario, plataforma, guildId) {
  const { guild, permissoes } = await abrirServidor(usuario, plataforma, guildId);

  const [config, bloqueado, canais] = await Promise.all([
    Guild.findOne({ guildId: String(guild.id) }).lean(),
    Bloqueio.exists({ tipo: 'servidor', id: String(guild.id) }),
    plataformas.listarCanais(plataforma, guild)
  ]);

  return {
    servidor: plataformas.resumoDoServidor(plataforma, guild),
    config: visaoDaConfig(config, bloqueado),
    canais,
    permissoes: { ...permissoes, equipe: Boolean(usuario.equipe) }
  };
}

function lerBooleano(valor, campo) {
  if (typeof valor !== 'boolean') throw new ErroPainel(400, `Valor inválido para ${campo}`);
  return valor;
}

async function validarCanalDeTexto(plataforma, guild, canalId) {
  if (!ehSnowflake(String(canalId))) throw new ErroPainel(400, 'Canal inválido');
  if (plataformas.servidorAdulto(guild)) throw new ErroPainel(400, 'Servidores +18 não podem usar o Global (veja a Política de Privacidade)');

  const canais = await plataformas.listarCanais(plataforma, guild);
  const canal = canais.find((c) => c.id === String(canalId));
  if (!canal) throw new ErroPainel(400, 'Esse canal não existe neste servidor');
  if (canal.nsfw) throw new ErroPainel(400, 'Não é possível conectar um canal +18 (veja a Política de Privacidade)');

  return canal;
}

async function validarCanal(plataforma, guild, canalId) {
  await validarCanalDeTexto(plataforma, guild, canalId);

  const ocupado = await Guild.exists({ canalId: String(canalId), guildId: { $ne: String(guild.id) } });
  if (ocupado || !(await canalEstaLivre(String(canalId)))) {
    throw new ErroPainel(409, 'Esse canal já tem uma conexão ativa');
  }
}

async function montarAlteracoes(usuario, plataforma, guild, atual, corpo) {
  const novo = {};

  for (const campo of BOOLEANOS) {
    if (campo in corpo) novo[campo] = lerBooleano(corpo[campo], campo);
  }

  if ('modoEnvio' in corpo) {
    if (!['embed', 'webhook'].includes(corpo.modoEnvio)) throw new ErroPainel(400, 'Modo de envio inválido');
    novo.modoEnvio = corpo.modoEnvio;
  }

  if ('cor' in corpo) {
    if (!usuario.equipe) throw new ErroPainel(403, 'Só a equipe altera a cor do servidor');
    if (corpo.cor === null) {
      novo.cor = null;
    } else {
      const m = COR_HEX.exec(String(corpo.cor));
      if (!m) throw new ErroPainel(400, 'Use uma cor no formato #RRGGBB');
      novo.cor = parseInt(m[1], 16);
    }
  }

  if ('canalId' in corpo) {
    if (corpo.canalId === null) {
      Object.assign(novo, { canalId: null, pausado: false, filtrarPalavroes: true, filtrarLinks: false });
    } else {
      if (String(corpo.canalId) !== atual.canalId) await validarCanal(plataforma, guild, corpo.canalId);
      novo.canalId = String(corpo.canalId);
      novo.plataforma = plataforma;
    }
  }

  return novo;
}

async function alterarServidor(usuario, plataforma, guildId, corpo) {
  const { guild } = await abrirServidor(usuario, plataforma, guildId);
  const gId = String(guild.id);

  const existente = await Guild.findOne({ guildId: gId }).lean();
  const antes = visaoDaConfig(existente);

  if (corpo && corpo.canalId && await Bloqueio.exists({ tipo: 'servidor', id: gId })) {
    throw new ErroPainel(403, 'Este servidor está bloqueado do Global');
  }

  const novo = await montarAlteracoes(usuario, plataforma, guild, antes, corpo || {});

  if (Object.keys(novo).length === 0) throw new ErroPainel(400, 'Nenhuma alteração enviada');

  await Guild.findOneAndUpdate({ guildId: gId }, { $set: novo }, { upsert: true, setDefaultsOnInsert: true });
  if ('canalId' in novo) limparFalhasDestino(gId);

  const depois = visaoDaConfig({ ...(existente || {}), ...novo });
  const registros = Object.keys(novo)
    .filter((campo) => campo in depois && JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo]))
    .map((campo) => ({
      guildId: gId,
      plataforma,
      userId: usuario.id,
      userNome: usuario.nome,
      userPlataforma: usuario.plataforma,
      campo,
      de: antes[campo] ?? null,
      para: depois[campo] ?? null
    }));

  if (registros.length > 0) await AlteracaoPainel.insertMany(registros);
  cacheLista.clear();
  log.ok('PAINEL', `${usuario.nome} (${usuario.plataforma}:${usuario.id}) alterou ${Object.keys(novo).join(', ')} em ${plataforma}:${gId}`);

  return detalhesDoServidor(usuario, plataforma, guildId);
}

async function logsDoServidor(usuario, plataforma, guildId) {
  const { guild } = await abrirServidor(usuario, plataforma, guildId);

  const alteracoes = await AlteracaoPainel.find({ guildId: String(guild.id) })
    .sort({ criadoEm: -1 })
    .limit(100)
    .lean();

  return alteracoes.map((a) => ({
    campo: a.campo,
    de: a.de,
    para: a.para,
    autor: { id: a.userId, nome: a.userNome, plataforma: a.userPlataforma },
    em: new Date(a.criadoEm).getTime()
  }));
}

module.exports = {
  listarServidores,
  detalhesDoServidor,
  alterarServidor,
  logsDoServidor,
  abrirServidor,
  validarCanalDeTexto
};
