const IDS = {
  otobank: '01M82FN14P00B0GBW71WAYCKJM',
  contribuidor: '01M82FQNW18D3GDBRRA29DMJ0T',
  verificado: '01M82FV2PNDP90NKG5D2RZD5FQ',
  staff: '01M82FVAGMHG55HVBD164KSSBK',
  parceiro: '01M82FVKGV6F6H3QWF28YTRKKA',
  developer: '01M82FW4Q60SC3DXA3V3MBXVNH',
  conversador: '01M82FWEK192XKG3E7WHHK1FY9',
  reply_r: '01M82FWRMZH6X1MVGPPJJF6TKY',
  reply_l: '01M82FX179V6KCQ37EVQ3AJG1G',
  externallinkfill: '01M82G3VBY97T957VWED3MW7ZA',
  chatprivatefill: '01M82G37W4YR142QR9Z01SQY4X',
  windowfill: '01M82G2MK97FMA8RSB3BVB9BHX',
  discussfill: '01M82G185M6J0XP8J81CZ318D7',
  terminalwindowfill: '01M82G0X3SB0M1Y7BMCDFV4WRV',
  heart2fill: '01M82G07X7NGDDWEXS1RVP2X8A',
  pingpongfill: '01M82FZ7QXYJK7NG267152W11J',
  imagefill: '01M82FYRWRFQN6QM3HXMWT0909',
  chat1fill: '01M82FXFKNT1JHN6DBH5RXNMMC',
  editfill: '01M82G464X31TGVHNWS5YW2PZW',
  brushaifill: '01M82G4M5RT0252P26MT9HPPRY',
  earthline1: '01M82G4ZWMSZS4D8EK9827SWXQ',
  earthline: '01M82G4ZWMSZS4D8EK9827SWXQ',
  checkboxfill: '01M82GA5K40WHPH03BZPD9V185',
  toggleline: '01M82GAM8BAE9WFGC2MSH8SHE4',
  togglefill: '01M82GAZXB7Q37B48TTRJ1P3DM',
  forbidline: '01M82GBDTGJJNEHKBDD9PGMNXT',
  information2fill: '01M82GBT86BHY5416M1ZA9YS9Q',
  errorwarningfill: '01M82GC9G9V1PCJ9XG59768028',
  checkboxcirclefill: '01M82GD5929PMVM83NJ9M9JSBZ',
  closecirclefill: '01M82GCPKH9VGR4CC45JP6CFCX'
};

const PADRAO = /<a?:([\w~]+):\d+>/g;

function emojiDoStoat(nome) {
  return IDS[nome] ? `:${IDS[nome]}:` : '';
}

function emojisParaStoat(texto) {
  return String(texto || '').replace(PADRAO, (_, nome) => emojiDoStoat(nome));
}

module.exports = { IDS, emojiDoStoat, emojisParaStoat };
