const Palavra = require('../../models/Palavra');
const Bloqueio = require('../../models/Bloqueio');
const User = require('../../models/User');
const AlteracaoPainel = require('../../models/AlteracaoPainel');
const { DONO_ID, SUPORTE_GUILD_ID } = require('../../config');
const { ehSnowflake } = require('../../util/ids');
const { log } = require('../../util/logger');
const { recarregarPalavras, totalEntradas } = require('../filtros/palavras');
const { normalizarTexto } = require('../filtros/normalizacao');
const { ErroPainel } = require('./erros');
const servidores = require('./servidores');

const ACOES_FILTRO = {
  add: { tipo: 'proibida', inserir: true },
  remove: { tipo: 'proibida', inserir: false },
  liberar: { tipo: 'liberada', inserir: true },
  desliberar: { tipo: 'liberada', inserir: false }
};

async function registrar(usuario, campo, para) {
  await AlteracaoPainel.create({
    guildId: 'global',
    userId: usuario.id,
    userNome: usuario.nome,
    userPlataforma: usuario.plataforma,
    campo,
    para
  });
}

function exigirEquipe(usuario) {
  if (!usuario.equipe) throw new ErroPainel(403, 'Área restrita à equipe');
}

async function todosOsServidores(usuario) {
  exigirEquipe(usuario);
  return servidores.listarServidores(usuario, { todos: true });
}

async function listarFiltro(usuario) {
  exigirEquipe(usuario);

  const palavras = await Palavra.find().sort({ palavra: 1 }).lean();

  return {
    proibidas: palavras.filter((p) => p.tipo === 'proibida').map((p) => p.palavra),
    liberadas: palavras.filter((p) => p.tipo === 'liberada').map((p) => p.palavra),
    totalEntradas: totalEntradas()
  };
}

async function alterarFiltro(usuario, corpo) {
  exigirEquipe(usuario);

  const acao = ACOES_FILTRO[corpo.acao];
  if (!acao) throw new ErroPainel(400, 'Ação inválida');

  const palavra = normalizarTexto(String(corpo.palavra || '')).trim();
  if (palavra.length < 2 || palavra.length > 50) {
    throw new ErroPainel(400, 'A palavra precisa ter entre 2 e 50 caracteres');
  }

  if (acao.inserir) {
    await Palavra.updateOne({ palavra, tipo: acao.tipo }, { $setOnInsert: { palavra, tipo: acao.tipo } }, { upsert: true });
  } else {
    await Palavra.deleteOne({ palavra, tipo: acao.tipo });
  }

  await recarregarPalavras();
  await registrar(usuario, `filtro:${corpo.acao}`, palavra);
  log.ok('PAINEL', `${usuario.nome} (${usuario.plataforma}:${usuario.id}) filtro ${corpo.acao}`);

  return listarFiltro(usuario);
}

async function listarBloqueios(usuario) {
  exigirEquipe(usuario);

  const lista = await Bloqueio.find().sort({ criadoEm: -1 }).lean();

  return lista.map((b) => ({ tipo: b.tipo, id: b.id, motivo: b.motivo, por: b.por, criadoEm: b.criadoEm }));
}

function ehDono(usuario) {
  return usuario.id === DONO_ID;
}

async function bloquear(usuario, corpo) {
  exigirEquipe(usuario);

  const tipo = corpo.tipo;
  const id = String(corpo.id || '').trim();
  if (!['usuario', 'servidor'].includes(tipo) || !ehSnowflake(id)) throw new ErroPainel(400, 'Tipo ou ID inválido');

  if (tipo === 'usuario') {
    if (id === DONO_ID || id === usuario.id) throw new ErroPainel(400, 'Você não pode bloquear esse usuário');
    if (!ehDono(usuario) && await User.exists({ userId: id, staff: true })) {
      throw new ErroPainel(403, 'Somente o desenvolvedor do Global pode bloquear um staff');
    }
  } else if (id === SUPORTE_GUILD_ID) {
    throw new ErroPainel(400, 'Você não pode bloquear o servidor de suporte');
  }

  const motivo = String(corpo.motivo || '').trim().slice(0, 200) || null;

  await Bloqueio.findOneAndUpdate(
    { tipo, id },
    { motivo, por: usuario.id, criadoEm: Date.now() },
    { upsert: true }
  );
  await registrar(usuario, `bloqueio:${tipo}`, id);
  log.ok('PAINEL', `${usuario.nome} (${usuario.plataforma}:${usuario.id}) bloqueou ${tipo} ${id}`);

  return listarBloqueios(usuario);
}

async function desbloquear(usuario, tipo, id) {
  exigirEquipe(usuario);

  if (!['usuario', 'servidor'].includes(tipo) || !ehSnowflake(String(id))) throw new ErroPainel(400, 'Tipo ou ID inválido');

  const r = await Bloqueio.deleteOne({ tipo, id: String(id) });
  if (r.deletedCount === 0) throw new ErroPainel(404, 'Esse alvo não está bloqueado');

  await registrar(usuario, `desbloqueio:${tipo}`, String(id));
  log.ok('PAINEL', `${usuario.nome} (${usuario.plataforma}:${usuario.id}) desbloqueou ${tipo} ${id}`);

  return listarBloqueios(usuario);
}

module.exports = {
  todosOsServidores,
  listarFiltro,
  alterarFiltro,
  listarBloqueios,
  bloquear,
  desbloquear
};
