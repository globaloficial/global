const EMOJI = {
  sucesso: '<:checkboxcirclefill:1562606683371339777>',
  erro: '<:closecirclefill:1562606683371339786>',
  info: '<:information2fill:1562606683371339784>',
  espera: '<:forbidline:1562606683371339778>',
  ligado: '<:togglefill:1562606683371339783>',
  desligado: '<:toggleline:1562606683371339782>',
  mundo: '<:earthline1:1562606683371339780>',
  pincel: '<:brushaifill:1562606683371339785>',
  editar: '<:editfill:1571001388731731968>',
  externo: '<:externallinkfill:1571009623865962496>',
  privado: '<:chatprivatefill:1571009637010907136>',
  janela: '<:windowfill:1571271490920263680>',
  conversa: '<:discussfill:1571271962750091265>',
  terminal: '<:terminalwindowfill:1571274108375674881>',
  coracao: '<:heart2fill:1562975992086007808>',
  pingue: '<:pingpongfill:1571277394264719361>'
};

const SUPORTE = 'https://support.globalbot.site';
const LINHA_ERRO = `Você acha que isso é um [erro](${SUPORTE})?`;

function montar(emoji, titulo, texto, { acima, abaixo } = {}) {
  return [
    `# ${emoji} ${titulo}`,
    acima ? `-# ${acima}` : null,
    texto,
    abaixo ? `-# ${abaixo}` : null
  ].filter((linha) => linha !== null && linha !== undefined).join('\n');
}

function sucesso(titulo, texto, opcoes) {
  return montar(EMOJI.sucesso, titulo, texto, opcoes);
}

function info(titulo, texto, opcoes) {
  return montar(EMOJI.info, titulo, texto, opcoes);
}

function espera(titulo, texto, opcoes) {
  return montar(EMOJI.espera, titulo, texto, opcoes);
}

function erro(titulo, texto, opcoes = {}) {
  const abaixo = opcoes.abaixo === undefined ? LINHA_ERRO : opcoes.abaixo;
  return montar(EMOJI.erro, titulo, texto, { ...opcoes, abaixo });
}

function erroSimples(titulo, texto, opcoes = {}) {
  return erro(titulo, texto, { ...opcoes, abaixo: opcoes.abaixo === undefined ? null : opcoes.abaixo });
}

function digitadoPelaPessoa(message, prefixo) {
  const bruto = String((message && message.content) || '').trim();
  const semPrefixo = bruto.startsWith(prefixo) ? bruto.slice(prefixo.length) : bruto;
  return semPrefixo.trim() || 'g.comando';
}

function usoIncorreto(message, prefixo, titulo, uso) {
  const digitado = digitadoPelaPessoa(message, prefixo);
  return erroSimples(
    titulo,
    `O uso correto deste comando seria \`${uso}\`, não é *${prefixo}${digitado}* como você escreveu...`
  );
}

const SEM_PERMISSAO = {
  canais: erroSimples(
    'Sem permissões, oh no.',
    'Você precisa ter a permissão de **Gerenciar canais** para poder acessar esse comando, ou peça pra algum Administrador fazer esse favorzão pra você.'
  ),
  painel: erroSimples(
    'Falta de permissões',
    'Você deve ter permissão de **Gerenciar Canais** para acessar a este painel, ou a menos que você seja um mini xMqR.'
  ),
  staff: erroSimples(
    'Sem permissões, oh no.',
    'Só a **staff do Global** pode usar esse comando, ou peça pra alguém da equipe fazer esse favorzão pra você.'
  ),
  dono: erroSimples(
    'Só o chefe',
    '**Somente o desenvolvedor do Global** pode realizar essa ação.'
  )
};

function semConexao(prefixo) {
  return erroSimples(
    'Nada aqui...',
    `Você deve ter esquecido que primeiro você conecta a **Conexão Global** com \`${prefixo}conectar\`, obrigado, foi bom te ajudar.`
  );
}

function mencao(id) {
  return `<@${id}>`;
}

module.exports = {
  EMOJI,
  SUPORTE,
  LINHA_ERRO,
  montar,
  sucesso,
  info,
  espera,
  erro,
  erroSimples,
  usoIncorreto,
  SEM_PERMISSAO,
  semConexao,
  mencao
};
