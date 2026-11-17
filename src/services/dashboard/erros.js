class ErroPainel extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

module.exports = { ErroPainel };
