function criarLimitador({ janelaMs = 60_000, maximo = 60 } = {}) {
  const janelas = new Map();

  setInterval(() => {
    const agora = Date.now();
    for (const [chave, tempos] of janelas) {
      if (!tempos.some((t) => agora - t < janelaMs)) janelas.delete(chave);
    }
  }, 5 * 60_000).unref();

  return function excedeu(chave) {
    const agora = Date.now();
    const atual = (janelas.get(chave) || []).filter((t) => agora - t < janelaMs);
    atual.push(agora);
    janelas.set(chave, atual);
    return atual.length > maximo;
  };
}

module.exports = { criarLimitador };
