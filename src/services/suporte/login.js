const { API, SITE, PROVEDORES } = require('./config');
const sessao = require('./sessao');

const redirecionar = (provedor) => `${API}/auth/${provedor}/callback`;

function iniciarLogin(provedor) {
  const config = PROVEDORES[provedor];
  if (!config || !config.clientId) return null;

  const { estado, cookie } = sessao.criarEstado(provedor);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirecionar(provedor),
    response_type: 'code',
    scope: config.escopo,
    state: estado
  });

  return { url: `${config.autorizar}?${params}`, cookie };
}

async function trocarCodigo(provedor, codigo) {
  const config = PROVEDORES[provedor];
  const resposta = await fetch(config.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: redirecionar(provedor)
    })
  });
  if (!resposta.ok) throw new Error(`Troca do código falhou (${resposta.status})`);

  const dados = await resposta.json();
  if (!dados.access_token) throw new Error('Resposta sem access_token');
  return dados.access_token;
}

async function buscarUsuario(provedor, token) {
  const config = PROVEDORES[provedor];
  const resposta = await fetch(config.usuario, { headers: { Authorization: `Bearer ${token}` } });
  if (!resposta.ok) throw new Error(`Leitura do usuário falhou (${resposta.status})`);

  const dados = await resposta.json();
  if (!dados.id) throw new Error('Usuário sem id');

  return {
    plataforma: provedor,
    id: String(dados.id),
    nome: String(dados.global_name || dados.username || 'Usuário').slice(0, 64),
    avatar: dados.avatar ? config.avatar(dados.id, dados.avatar) : null
  };
}

async function concluirLogin(req, provedor, url) {
  const codigo = url.searchParams.get('code');
  const estado = url.searchParams.get('state');

  if (!codigo || !sessao.validarEstado(req, provedor, estado)) {
    return { destino: `${SITE}/?login=erro`, cookies: [sessao.limparCookie(sessao.COOKIE_ESTADO)] };
  }

  const token = await trocarCodigo(provedor, codigo);
  const usuario = await buscarUsuario(provedor, token);

  return {
    destino: `${SITE}/?login=ok`,
    cookies: [sessao.criarSessao(usuario), sessao.limparCookie(sessao.COOKIE_ESTADO)]
  };
}

module.exports = { iniciarLogin, concluirLogin };
