const { criarFila } = require('../../services/entrega/fila');

module.exports = criarFila({
  nome: 'stoat',
  concorrencia: Number(process.env.STOAT_CONCORRENCIA) || 5,
  taxaMaxima: Number(process.env.STOAT_REQS_POR_SEGUNDO) || 8
});
