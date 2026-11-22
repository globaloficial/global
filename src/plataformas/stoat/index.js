const { registrarPlataforma } = require('..');
const api = require('./api');
const adaptador = require('./adaptador');
const { criarGateway } = require('./gateway');
const { aoEvento, carregarIdentidade } = require('./eventos');
const { log } = require('../../util/logger');

let gateway = null;

async function iniciarStoat(token) {
  api.definirToken(token);
  await api.obterConfiguracao(true);
  const eu = await carregarIdentidade();
  registrarPlataforma(adaptador);
  log.ok('STOAT', `Autenticado como ${eu.username} (${eu._id})`);

  gateway = criarGateway({ token, aoEvento });
  await gateway.conectar();
}

async function encerrarStoat() {
  if (gateway) gateway.parar();
  gateway = null;
}

module.exports = { iniciarStoat, encerrarStoat };
