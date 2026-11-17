const { ehStaffOuDono } = require('../../services/permissoes');
const { log, descreverContexto } = require('../../util/logger');
const { SEM_PERMISSAO } = require('../../util/respostas');

function tipoBloqueio(token) {
  const t = (token || '').toLowerCase();
  if (['usuario', 'usuário', 'user', 'u'].includes(t)) return 'usuario';
  if (['servidor', 'server', 'guild', 's'].includes(t)) return 'servidor';
  return null;
}

async function negarSeNaoStaff(message) {
  if (await ehStaffOuDono(message.author.id)) return false;
  log.warn('ACESSO', `Acesso negado (staff) para ${descreverContexto(message)}`);
  await message.reply(SEM_PERMISSAO.staff);
  return true;
}

module.exports = { tipoBloqueio, negarSeNaoStaff };
