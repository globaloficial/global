const EMOJIS = {
  checkboxcirclefill: ['checkboxcirclefill', '1571357853590229042'],
  closecirclefill: ['closecirclefill', '1571357854995189881'],
  information2fill: ['information2fill', '1571357856509333524'],
  forbidline: ['forbidfill', '1571357858082328646'],
  errorwarningfill: ['errorwarningfill', '1571357860049195170'],
  togglefill: ['togglefill', '1571357861538304020'],
  toggleline: ['toggleline', '1571357863425736754'],
  earthline1: ['earthline', '1571357865464303686'],
  heart2fill: ['pokerheartsfill', '1571357991196827739'],
  brushaifill: ['brushfill', '1571357874964406324'],
  editfill: ['edit2fill', '1571357876507643954'],
  externallinkfill: ['externallinkfill', '1571357878110003371'],
  chatprivatefill: ['chatprivatefill', '1571357879716548608'],
  chat1fill: ['chat1fill', '1571358014777200740'],
  imagefill: ['imagefill', '1571357892286750843'],
  windowfill: ['windowfill', '1571357895100989651'],
  discussfill: ['discussfill', '1571357897521234090'],
  terminalwindowfill: ['terminalwindowfill', '1571357900444803092'],
  pingpongfill: ['pingpongfill', '1571357902571307048'],
  contribuidor: ['contribuidor', '1571549798979346726'],
  otobank: ['otobank', '1571549827098087454'],
  reply_l: ['reply_l', '1572363999369109688'],
  reply_r: ['reply_r', '1572364084970528818'],
  conversador: ['conversador', '1571357903980597258'],
  developer: ['developer', '1571357906077618296'],
  parceiro: ['parceiro', '1571357847877451876'],
  staff: ['staff', '1571357849987063808'],
  verificado: ['verificado', '1571357852189200495']
};

const PADRAO = /<a?:([\w~]+):\d+>/g;

function emojiDiscord(nome) {
  const par = EMOJIS[nome];
  return par ? `<:${par[0]}:${par[1]}>` : '';
}

function trocarEmojis(texto) {
  return String(texto).replace(PADRAO, (_, nome) => emojiDiscord(nome));
}

function emojiDoBotao(codigo) {
  const m = String(codigo).match(/^<a?:([\w~]+):\d+>$/);
  const par = m && EMOJIS[m[1]];
  return par ? { name: par[0], id: par[1] } : null;
}

module.exports = { EMOJIS, emojiDiscord, trocarEmojis, emojiDoBotao };
