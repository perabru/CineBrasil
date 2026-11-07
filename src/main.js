import './style.css'
import { requisicao, modoLocal } from './api.js'

// Estado da aplicacao: tudo que pode mudar durante o uso do site.
const estado = {
  usuario: null,
  filmes: [],
  favoritos: new Set(),
  aba: 'todos',
  busca: '',
  genero: '',
  modoAuth: 'login',
  editando: null,
  filmeAberto: null,
  erroServidor: false,
}
const $ = (seletor) => document.querySelector(seletor)
const $$ = (seletor) => [...document.querySelectorAll(seletor)]
const criar = (tag, classe = '', texto) => {
  const elemento = document.createElement(tag)
  if (classe) elemento.className = classe
  if (texto !== undefined) elemento.textContent = String(texto)
  return elemento
}
const anos = (quantidade) => quantidade === 1 ? '1 filme' : `${quantidade} filmes`
const temaPoster = (id) => `poster-${Math.abs(Number(id) || 0) % 5}`
let temporizadorToast

function notificar(mensagem) {
  const toast = $('#toast')
  toast.textContent = mensagem
  toast.classList.add('show')
  clearTimeout(temporizadorToast)
  temporizadorToast = setTimeout(() => toast.classList.remove('show'), 3500)
}
function abrirModal(seletor) { $(seletor).showModal() }
function fecharModal(seletor) { $(seletor).close() }

function abrirAutenticacao(modo = 'login') {
  if (modoLocal) {
    $('#auth-title').textContent = 'Seu perfil neste navegador'
    $('#auth-subtitle').textContent = 'Catálogo, nome e favoritos ficam neste dispositivo. Sem conta online ou sincronização.'
    $('#nome-field').classList.remove('hidden')
    $('#auth-nome').required = true
    for (const id of ['auth-email','auth-senha']) { const el = $('#'+id); el.required = false; el.disabled = true; el.parentElement.classList.add('hidden') }
    $('#auth-switch-text').classList.add('hidden')
    $('#auth-submit').textContent = 'Abrir perfil local'
    $('#auth-error').textContent = ''
    $('#auth-form').reset()
    abrirModal('#auth-modal')
    return
  }
  estado.modoAuth = modo
  const cadastro = modo === 'cadastro'
  $('#auth-title').textContent = cadastro ? 'Crie sua conta' : 'Entre na sua conta'
  $('#auth-subtitle').textContent = cadastro
    ? 'Guarde seus favoritos e monte seu próprio universo de filmes.'
    : 'Entre para continuar de onde parou e acessar sua lista.'
  $('#nome-field').classList.toggle('hidden', !cadastro)
  $('#auth-nome').required = cadastro
  $('#auth-senha').autocomplete = cadastro ? 'new-password' : 'current-password'
  $('#auth-submit').textContent = cadastro ? 'Criar conta' : 'Entrar'
  $('#auth-switch-text').firstChild.textContent = cadastro ? 'Já tem conta? ' : 'Ainda não tem conta? '
  $('#auth-switch').textContent = cadastro ? 'Fazer login' : 'Criar conta'
  $('#auth-error').textContent = ''
  $('#auth-form').reset()
  if (!$('#auth-modal').open) abrirModal('#auth-modal')
}
function desenharUsuario() {
  const logado = Boolean(estado.usuario)
  $('#btn-entrar').classList.toggle('hidden', logado)
  $('#btn-cadastrar').classList.toggle('hidden', logado)
  $('#user-control').classList.toggle('hidden', !logado)
  $('#btn-add-filme').classList.toggle('hidden', estado.usuario?.papel !== 'admin')
  if (logado) {
    $('#user-name').textContent = estado.usuario.nome.split(' ')[0]
    $('#user-avatar').textContent = estado.usuario.nome.charAt(0).toUpperCase()
  }
  $('#fav-count').textContent = estado.favoritos.size
}
function selecionarAba(aba) {
  if (aba === 'favoritos' && !estado.usuario) {
    abrirAutenticacao('login')
    notificar('Entre na sua conta para acessar sua lista.')
    return
  }
  estado.aba = aba
  $$('.tab').forEach((botao) => {
    const ativo = botao.dataset.tab === aba
    botao.classList.toggle('active', ativo)
    botao.setAttribute('aria-pressed', String(ativo))
  })
  desenharCatalogo()
  $('#filmes').scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function atualizarGeneros() {
  const seletor = $('#genero')
  const generos = [...new Set(estado.filmes.map((f) => f.genero))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  seletor.replaceChildren(new Option('Todos os gêneros', ''))
  generos.forEach((genero) => seletor.add(new Option(genero, genero)))
  if (!generos.includes(estado.genero)) estado.genero = ''
  seletor.value = estado.genero
}
function cartaz(filme, classe = '') {
  const caixa = criar('div', `poster ${temaPoster(filme.id)} ${classe}`)
  const textura = criar('div', 'poster-grain')
  const marca = criar('span', 'poster-symbol', '✦')
  const conteudo = criar('div', 'poster-lettering')
  conteudo.append(criar('span', 'poster-caption', 'CINEMA BRASILEIRO'))
  conteudo.append(criar('strong', 'poster-name', filme.titulo))
  conteudo.append(criar('small', 'poster-year', String(filme.ano)))
  caixa.append(textura, marca, conteudo)
  if (filme.capa_url) {
    const imagem = criar('img', 'poster-image')
    imagem.src = filme.capa_url
    imagem.alt = `Cartaz de ${filme.titulo}`
    imagem.loading = 'lazy'
    imagem.referrerPolicy = 'no-referrer'
    imagem.onerror = () => imagem.remove()
    caixa.append(imagem)
  }
  return caixa
}
async function mudarFavorito(id) {
  if (!estado.usuario) {
    abrirAutenticacao('login')
    notificar('Crie uma conta ou entre para salvar filmes.')
    return
  }
  const existe = estado.favoritos.has(id)
  try {
    await requisicao(`/favoritos/${id}`, { method: existe ? 'DELETE' : 'POST', body: '{}' })
    if (existe) estado.favoritos.delete(id)
    else estado.favoritos.add(id)
    desenharUsuario()
    desenharCatalogo()
    if ($('#movie-modal').open && estado.filmeAberto === id) mostrarDetalhes(id, true)
    notificar(existe ? 'Filme removido da sua lista.' : 'Filme salvo na sua lista!')
  } catch (e) { notificar(e.message) }
}
function cartaoFilme(filme) {
  const cartao = criar('article', 'movie-card')
  const abrir = criar('button', 'card-open')
  abrir.type = 'button'
  abrir.setAttribute('aria-label', `Ver detalhes de ${filme.titulo}`)
  abrir.append(cartaz(filme))
  abrir.addEventListener('click', () => mostrarDetalhes(filme.id))
  const conteudo = criar('div', 'movie-content')
  conteudo.append(criar('span', 'movie-genre', filme.genero))
  conteudo.append(criar('h3', 'movie-title', filme.titulo))
  conteudo.append(criar('p', 'movie-meta', `${filme.ano} · ${filme.duracao_min} min`))
  const fav = criar('button', `favorite-button ${estado.favoritos.has(filme.id) ? 'selected' : ''}`, estado.favoritos.has(filme.id) ? '♥' : '♡')
  fav.type = 'button'
  fav.title = estado.favoritos.has(filme.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
  fav.setAttribute('aria-label', fav.title)
  fav.addEventListener('click', () => mudarFavorito(filme.id))
  conteudo.append(fav)
  cartao.append(abrir, conteudo)
  return cartao
}
function desenharCatalogo() {
  const grade = $('#movie-grid')
  const texto = estado.busca.toLocaleLowerCase('pt-BR').trim()
  const filmes = estado.filmes.filter((filme) => {
    const pesquisa = `${filme.titulo} ${filme.genero} ${filme.ano}`.toLocaleLowerCase('pt-BR').includes(texto)
    const genero = !estado.genero || filme.genero === estado.genero
    const favorito = estado.aba !== 'favoritos' || estado.favoritos.has(filme.id)
    return pesquisa && genero && favorito
  })
  grade.replaceChildren(...filmes.map(cartaoFilme))
  $('#results-count').textContent = `${anos(filmes.length)} encontrado${filmes.length === 1 ? '' : 's'}`
  const vazio = !filmes.length
  $('#empty-state').classList.toggle('hidden', !vazio)
  $('#empty-add').classList.toggle('hidden', estado.usuario?.papel !== 'admin')
  if (vazio) {
    const semFilmes = estado.filmes.length === 0
    $('#empty-title').textContent = estado.erroServidor ? 'O catálogo está indisponível' : semFilmes ? 'A estreia vem aí.' : estado.aba === 'favoritos' ? 'Sua lista está vazia.' : 'Nenhum filme encontrado.'
    $('#empty-description').textContent = estado.erroServidor
      ? 'O banco ainda não respondeu. Confira a conexão MySQL e tente atualizar a página.'
      : semFilmes ? 'Ainda não cadastramos filmes. Quando você adicionar o primeiro, ele aparecerá aqui.'
      : estado.aba === 'favoritos' ? 'Clique no coração de um filme para salvá-lo nesta lista.'
      : 'Tente outro nome ou escolha um gênero diferente.'
  }
}

function mostrarDetalhes(id, atualizar = false) {
  const filme = estado.filmes.find((f) => f.id === id)
  if (!filme) return
  estado.filmeAberto = id
  const destino = $('#movie-detail')
  destino.replaceChildren()
  const poster = cartaz(filme, 'detail-poster')
  const corpo = criar('div', 'detail-info')
  corpo.append(criar('p', 'section-kicker', 'CINEBRASIL / DETALHES'))
  const titulo = criar('h2', 'detail-title', filme.titulo)
  titulo.id = 'detail-title'
  corpo.append(titulo)
  corpo.append(criar('p', 'detail-facts', `${filme.ano}   •   ${filme.genero}   •   ${filme.duracao_min} min`))
  corpo.append(criar('p', 'detail-synopsis', filme.sinopse))
  const acoes = criar('div', 'detail-actions')
  const favorito = criar('button', 'button button-primary', estado.favoritos.has(id) ? '♥  Remover da minha lista' : '♡  Adicionar à minha lista')
  favorito.type = 'button'
  favorito.addEventListener('click', () => mudarFavorito(id))
  acoes.append(favorito)
  if (filme.trailer_url) {
    const trailer = criar('a', 'button button-outline', '▶  Assistir trailer')
    trailer.href = filme.trailer_url
    trailer.target = '_blank'
    trailer.rel = 'noopener noreferrer'
    acoes.append(trailer)
  }
  corpo.append(acoes)
  if (estado.usuario?.papel === 'admin') {
    const adminActions = criar('div', 'detail-admin')
    const editar = criar('button', 'text-button', 'Editar filme')
    editar.addEventListener('click', () => { fecharModal('#movie-modal'); abrirEditor(id) })
    const excluir = criar('button', 'text-button danger', 'Excluir filme')
    excluir.addEventListener('click', async () => {
      if (!confirm(`Excluir "${filme.titulo}"? Essa ação não pode ser desfeita.`)) return
      try {
        await requisicao(`/filmes/${id}`, { method: 'DELETE', body: '{}' })
        fecharModal('#movie-modal')
        await carregarFilmes()
        notificar('Filme removido do catálogo.')
      } catch (e) { notificar(e.message) }
    })
    adminActions.append(editar, excluir)
    corpo.append(adminActions)
  }
  destino.append(poster, corpo)
  if (!atualizar) abrirModal('#movie-modal')
}

async function carregarFilmes() {
  try {
    const { filmes } = await requisicao('/filmes')
    estado.filmes = filmes
    estado.erroServidor = false
    $('#server-warning').classList.add('hidden')
  } catch (e) {
    estado.erroServidor = true
    estado.filmes = []
    $('#server-warning').classList.remove('hidden')
    $('#server-warning').textContent = `Não foi possível carregar o banco: ${e.message}`
  }
  atualizarGeneros()
  desenharCatalogo()
}
async function carregarFavoritos() {
  estado.favoritos.clear()
  if (estado.usuario) {
    try {
      const { ids } = await requisicao('/favoritos')
      estado.favoritos = new Set(ids)
    } catch (e) { notificar(e.message) }
  }
  desenharUsuario()
  desenharCatalogo()
}

function abrirEditor(id = null) {
  if (estado.usuario?.papel !== 'admin') return
  estado.editando = id
  const formulario = $('#editor-form')
  formulario.reset()
  $('#editor-error').textContent = ''
  const filme = estado.filmes.find((f) => f.id === id)
  $('#editor-title').textContent = filme ? 'Editar filme' : 'Adicionar filme'
  $('#editor-submit').textContent = filme ? 'Salvar alterações' : 'Cadastrar filme'
  if (filme) {
    for (const campo of ['titulo', 'ano', 'genero', 'duracao_min', 'sinopse', 'capa_url', 'trailer_url']) {
      formulario.elements.namedItem(campo).value = filme[campo] ?? ''
    }
  }
  abrirModal('#editor-modal')
}

// Eventos: os botoes chamam funcoes quando a pessoa interage com o site.
$('#btn-entrar').addEventListener('click', () => abrirAutenticacao('login'))
$('#btn-cadastrar').addEventListener('click', () => abrirAutenticacao('cadastro'))
$('#hero-cadastro').addEventListener('click', () => estado.usuario ? selecionarAba('favoritos') : abrirAutenticacao('cadastro'))
$('#closing-signup').addEventListener('click', () => estado.usuario ? selecionarAba('favoritos') : abrirAutenticacao('cadastro'))
$('#auth-switch').addEventListener('click', () => abrirAutenticacao(estado.modoAuth === 'login' ? 'cadastro' : 'login'))
$('#atalho-busca').addEventListener('click', () => { $('#filmes').scrollIntoView({ behavior: 'smooth' }); $('#busca').focus({ preventScroll: true }) })
$('#nav-favoritos').addEventListener('click', () => selecionarAba('favoritos'))
$$('[data-tab]').forEach((botao) => botao.addEventListener('click', () => selecionarAba(botao.dataset.tab)))
$('#busca').addEventListener('input', (e) => { estado.busca = e.target.value; desenharCatalogo() })
$('#genero').addEventListener('change', (e) => { estado.genero = e.target.value; desenharCatalogo() })
$('#btn-add-filme').addEventListener('click', () => abrirEditor())
$('#empty-add').addEventListener('click', () => abrirEditor())

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const botao = $('#auth-submit')
  const email = $('#auth-email').value
  const senha = $('#auth-senha').value
  const cadastro = estado.modoAuth === 'cadastro'
  const corpo = modoLocal ? {nome: $('#auth-nome').value} : cadastro ? { nome: $('#auth-nome').value, email, senha } : { email, senha }
  $('#auth-error').textContent = ''
  botao.disabled = true
  try {
    const { usuario } = await requisicao(cadastro ? '/auth/cadastro' : '/auth/login', { method: 'POST', body: JSON.stringify(corpo) })
    estado.usuario = usuario
    fecharModal('#auth-modal')
    await carregarFavoritos()
    notificar(modoLocal ? 'Perfil local aberto neste navegador.' : cadastro ? 'Conta criada! Bem-vindo ao CineBrasil.' : `Bem-vindo de volta, ${usuario.nome.split(' ')[0]}!`)
  } catch (e) { $('#auth-error').textContent = e.message }
  finally { botao.disabled = false }
})
$('#btn-sair').addEventListener('click', async () => {
  try {
    await requisicao('/auth/logout', { method: 'POST', body: '{}' })
    estado.usuario = null
    estado.favoritos.clear()
    estado.aba = 'todos'
    selecionarAba('todos')
    desenharUsuario()
    notificar('Você saiu da sua conta.')
  } catch (e) { notificar(e.message) }
})
$('#editor-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const dados = Object.fromEntries(new FormData(event.currentTarget))
  dados.ano = Number(dados.ano)
  dados.duracao_min = Number(dados.duracao_min)
  const id = estado.editando
  const botao = $('#editor-submit')
  botao.disabled = true
  $('#editor-error').textContent = ''
  try {
    await requisicao(id ? `/filmes/${id}` : '/filmes', { method: id ? 'PUT' : 'POST', body: JSON.stringify(dados) })
    fecharModal('#editor-modal')
    await carregarFilmes()
    notificar(id ? 'Filme atualizado com sucesso!' : 'Filme cadastrado com sucesso!')
  } catch (e) { $('#editor-error').textContent = e.message }
  finally { botao.disabled = false }
})
$$('.modal').forEach((modal) => {
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close() })
  modal.querySelector('[data-close]')?.addEventListener('click', () => modal.close())
})

async function iniciar() {
  if (modoLocal) {
    $('.form-note').textContent = 'Sem senha: este perfil fica somente neste navegador. Limpar os dados do site apaga as informações locais.'
    $$('p').find(p => p.textContent.includes('Faça parte dessa experiência. Crie uma conta')).textContent = 'Abra seu perfil local e monte sua lista de favoritos neste navegador.'
    $('#btn-entrar').textContent = 'Perfil local'
    $('#btn-cadastrar').textContent = 'Começar'
    const aviso = criar('p', 'local-notice', 'Versão GitHub Pages · Seus dados e alterações ficam somente neste navegador, sem sincronização entre dispositivos.')
    document.querySelector('main').prepend(aviso)
  }
  try {
    const { usuario } = await requisicao('/auth/me')
    estado.usuario = usuario
  } catch { /* catalogo mostrara o estado de erro se o servidor estiver desligado */ }
  desenharUsuario()
  await Promise.all([carregarFilmes(), carregarFavoritos()])
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.warn)
  }
}
iniciar()
