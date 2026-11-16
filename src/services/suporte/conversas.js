const Suporte = require('../../models/Suporte');
const Contador = require('../../models/Contador');
const { LIMITES } = require('./config');

const STATUS = ['aberta', 'andamento', 'resolvida'];

class ErroSuporte extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const limpar = (texto, max) => String(texto || '').replace(/\r/g, '').trim().slice(0, max);

function resumo(c) {
  return {
    id: c.numero,
    assunto: c.assunto,
    status: c.status,
    autor: { id: c.autorId, nome: c.autorNome, avatar: c.autorAvatar, plataforma: c.plataforma },
    mensagens: c.mensagens.length,
    ultimaMensagem: c.mensagens.length ? c.mensagens[c.mensagens.length - 1].texto.slice(0, 140) : '',
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm
  };
}

function detalhe(c) {
  return {
    ...resumo(c),
    mensagens: c.mensagens.map((m) => ({
      autor: { id: m.autorId, nome: m.autorNome, avatar: m.autorAvatar },
      equipe: m.equipe,
      texto: m.texto,
      em: m.em
    }))
  };
}

function podeVer(usuario, c) {
  return usuario.equipe || (c.plataforma === usuario.plataforma && c.autorId === usuario.id);
}

async function listar(usuario, status) {
  const filtro = usuario.equipe ? {} : { plataforma: usuario.plataforma, autorId: usuario.id };
  if (STATUS.includes(status)) filtro.status = status;

  const conversas = await Suporte.find(filtro).sort({ atualizadoEm: -1 }).limit(100);
  return conversas.map(resumo);
}

async function buscar(usuario, numero) {
  const c = await Suporte.findOne({ numero: Number(numero) });
  if (!c || !podeVer(usuario, c)) throw new ErroSuporte(404, 'Conversa não encontrada');
  return c;
}

async function obter(usuario, numero) {
  return detalhe(await buscar(usuario, numero));
}

async function criar(usuario, corpo) {
  const assunto = limpar(corpo.assunto, LIMITES.assunto);
  const texto = limpar(corpo.texto, LIMITES.texto);
  if (!assunto || !texto) throw new ErroSuporte(400, 'Preencha o assunto e a mensagem');

  const abertas = await Suporte.countDocuments({
    plataforma: usuario.plataforma,
    autorId: usuario.id,
    status: { $ne: 'resolvida' }
  });
  if (abertas >= LIMITES.abertasPorUsuario) {
    throw new ErroSuporte(429, 'Você já tem conversas abertas demais. Aguarde a equipe responder.');
  }

  const contador = await Contador.findOneAndUpdate(
    { chave: 'suporte' },
    { $inc: { valor: 1 } },
    { upsert: true, new: true }
  );

  const c = await Suporte.create({
    numero: contador.valor,
    plataforma: usuario.plataforma,
    autorId: usuario.id,
    autorNome: usuario.nome,
    autorAvatar: usuario.avatar,
    assunto,
    mensagens: [{ autorId: usuario.id, autorNome: usuario.nome, autorAvatar: usuario.avatar, equipe: false, texto }]
  });

  return detalhe(c);
}

async function responder(usuario, numero, corpo) {
  const texto = limpar(corpo.texto, LIMITES.texto);
  if (!texto) throw new ErroSuporte(400, 'Escreva uma mensagem');

  const c = await buscar(usuario, numero);
  if (c.status === 'resolvida' && !usuario.equipe) {
    throw new ErroSuporte(409, 'Esta conversa foi resolvida. Abra uma nova se precisar.');
  }

  c.mensagens.push({
    autorId: usuario.id,
    autorNome: usuario.nome,
    autorAvatar: usuario.avatar,
    equipe: usuario.equipe,
    texto
  });
  if (usuario.equipe && c.status === 'aberta') c.status = 'andamento';
  c.atualizadoEm = Date.now();
  await c.save();

  return detalhe(c);
}

async function mudarStatus(usuario, numero, corpo) {
  if (!usuario.equipe) throw new ErroSuporte(403, 'Apenas a equipe pode mudar o status');
  if (!STATUS.includes(corpo.status)) throw new ErroSuporte(400, 'Status inválido');

  const c = await buscar(usuario, numero);
  c.status = corpo.status;
  c.atualizadoEm = Date.now();
  await c.save();

  return detalhe(c);
}

module.exports = { ErroSuporte, listar, obter, criar, responder, mudarStatus };
