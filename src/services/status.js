const { client } = require('../lib/client');
const Guild = require('../models/Guild');
const { log } = require('../util/logger');

const STATUS_ROTATIVOS = [
  async () => 'Globalmente conversando',
  async () => `Em ${await Guild.countDocuments({ canalId: { $ne: null } })} comunidades`,
  async () => '@global | g.ajuda'
];

let intervaloStatus = null;

function iniciarStatusRotativo() {
  if (typeof client.user.setPresence !== 'function') {
    log.error('STATUS', 'Sua versão do @fluxerjs/core não tem client.user.setPresence. Rode: npm install @fluxerjs/core@latest');
    return;
  }

  let i = 0;
  const atualizar = async () => {
    try {
      const texto = await STATUS_ROTATIVOS[i % STATUS_ROTATIVOS.length]();
      client.user.setPresence({ status: 'online', customStatus: { text: texto } });
      i++;
    } catch (e) {
      log.error('STATUS', 'Erro ao atualizar presença', e);
    }
  };

  atualizar();
  if (intervaloStatus) clearInterval(intervaloStatus);
  intervaloStatus = setInterval(atualizar, 30_000);
}

module.exports = { iniciarStatusRotativo };
