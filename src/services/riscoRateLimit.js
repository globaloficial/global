const { estatisticas, bloqueioAtivo } = require('./entrega/fila');

function nivelDeRisco() {
  if (bloqueioAtivo()) {
    return 'Ativo, a API pediu uma pausa, as mensagens ficam em espera e saem sozinhas assim que liberar.';
  }

  const { pendentes, emVoo, rate429 } = estatisticas();
  const carga = pendentes + emVoo;

  if (pendentes >= 150) return 'Provável, a fila está grande, o Global vai segurar o envio para evitar bloqueio.';
  if (pendentes >= 40 || rate429 > 0) return 'Possível, a fila está crescendo, as mensagens podem demorar um pouco.';
  if (carga >= 10) return 'Improvável, movimento moderado.';
  return 'Improvável, fluxo livre.';
}

module.exports = { nivelDeRisco };
