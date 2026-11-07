import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { rateLimit } from 'express-rate-limit'
import { db } from './db.js'

const app = express()
const PORT = Number(process.env.PORT || 3001)
const production = process.env.NODE_ENV === 'production'
if (production && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Em producao, defina JWT_SECRET com ao menos 32 caracteres no .env.')
}
const secret = process.env.JWT_SECRET?.trim() || randomBytes(48).toString('hex')
if (!process.env.JWT_SECRET?.trim()) {
  console.warn('AVISO: JWT_SECRET temporaria. Ao reiniciar, sera necessario entrar novamente na conta.')
}

app.disable('x-powered-by')
app.use(express.json({ limit: '20kb' }))
app.use(cookieParser())
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos.' },
}))

// Aceitamos apenas JSON nas rotas que alteram o banco; os cookies sao SameSite.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!req.is('application/json')) return res.status(415).json({ erro: 'Envie dados em JSON.' })
    const origin = req.get('origin')
    if (origin) {
      try {
        const parsed = new URL(origin)
        // Em desenvolvimento, Vite e API rodam em portas distintas, mas apenas localhost.
        const isLocal = !production && ['localhost', '127.0.0.1'].includes(parsed.hostname)
        const isSameHost = parsed.host === req.get('host')
        if (!isLocal && !isSameHost) return res.status(403).json({ erro: 'Origem nao permitida.' })
      } catch { return res.status(403).json({ erro: 'Origem invalida.' }) }
    }
  }
  next()
})

const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: production, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 }
const erro = (res, status, mensagem) => res.status(status).json({ erro: mensagem })
const userView = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel })

async function usuarioOpcional(req, res, next) {
  const token = req.cookies.cinebr_token
  if (!token) return next()
  try {
    const data = jwt.verify(token, secret, { algorithms: ['HS256'] })
    const [[u]] = await db.execute('SELECT id, nome, email, papel FROM usuarios WHERE id = ?', [data.id])
    if (u) req.usuario = u
    next()
  } catch (e) {
    if (e.code) return next(e) // Erro do MySQL nao deve ser confundido com token invalido.
    next()
  }
}
const autenticar = (req, res, next) => req.usuario ? next() : erro(res, 401, 'Entre na sua conta para continuar.')
const admin = (req, res, next) => req.usuario?.papel === 'admin' ? next() : erro(res, 403, 'Apenas administradores podem fazer isso.')
app.use('/api', usuarioOpcional)

app.get('/api/health', async (_req, res, next) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', banco: 'conectado' }) } catch (e) { next(e) }
})

app.post('/api/auth/cadastro', async (req, res, next) => {
  try {
    const nome = String(req.body?.nome || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const senha = req.body?.senha
    if (nome.length < 2 || nome.length > 80) return erro(res, 400, 'Use um nome entre 2 e 80 caracteres.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) return erro(res, 400, 'Informe um e-mail valido.')
    if (typeof senha !== 'string' || senha.length < 8 || senha.length > 72) return erro(res, 400, 'A senha precisa ter entre 8 e 72 caracteres.')
    const hash = await bcrypt.hash(senha, 12)
    const [result] = await db.execute('INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)', [nome, email, hash])
    const usuario = { id: result.insertId, nome, email, papel: 'usuario' }
    res.cookie('cinebr_token', jwt.sign({ id: usuario.id }, secret, { algorithm: 'HS256', expiresIn: '7d' }), cookieOptions)
    res.status(201).json({ usuario })
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return erro(res, 409, 'Este e-mail ja esta cadastrado.')
    next(e)
  }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const senha = req.body?.senha
    if (!email || typeof senha !== 'string') return erro(res, 400, 'Preencha e-mail e senha.')
    const [[u]] = await db.execute('SELECT id, nome, email, papel, senha_hash FROM usuarios WHERE email = ?', [email])
    if (!u || !(await bcrypt.compare(senha, u.senha_hash))) return erro(res, 401, 'E-mail ou senha incorretos.')
    res.cookie('cinebr_token', jwt.sign({ id: u.id }, secret, { algorithm: 'HS256', expiresIn: '7d' }), cookieOptions)
    res.json({ usuario: userView(u) })
  } catch (e) { next(e) }
})

app.get('/api/auth/me', (req, res) => res.json({ usuario: req.usuario ? userView(req.usuario) : null }))
app.post('/api/auth/logout', (_req, res) => { res.clearCookie('cinebr_token', { path: '/', sameSite: 'strict', secure: production }); res.json({ ok: true }) })

app.get('/api/filmes', async (_req, res, next) => {
  try {
    const [filmes] = await db.execute('SELECT id, titulo, ano, genero, duracao_min, sinopse, capa_url, trailer_url FROM filmes ORDER BY criado_em DESC, id DESC')
    res.json({ filmes })
  } catch (e) { next(e) }
})

app.get('/api/favoritos', autenticar, async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT filme_id FROM favoritos WHERE usuario_id = ?', [req.usuario.id])
    res.json({ ids: rows.map((r) => r.filme_id) })
  } catch (e) { next(e) }
})
app.post('/api/favoritos/:id', autenticar, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id < 1) return erro(res, 400, 'Filme invalido.')
    await db.execute('INSERT IGNORE INTO favoritos (usuario_id, filme_id) VALUES (?, ?)', [req.usuario.id, id])
    res.json({ ok: true })
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return erro(res, 404, 'Filme nao encontrado.')
    next(e)
  }
})
app.delete('/api/favoritos/:id', autenticar, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id < 1) return erro(res, 400, 'Filme invalido.')
    await db.execute('DELETE FROM favoritos WHERE usuario_id = ? AND filme_id = ?', [req.usuario.id, id])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

function enderecoSeguro(valor) {
  if (!valor) return null
  try {
    const url = new URL(String(valor))
    return ['https:', 'http:'].includes(url.protocol) && url.href.length <= 700 ? url.href : null
  } catch { return null }
}
function validarFilme(body) {
  const titulo = String(body?.titulo || '').trim()
  const genero = String(body?.genero || '').trim()
  const sinopse = String(body?.sinopse || '').trim()
  const ano = Number(body?.ano)
  const duracao = Number(body?.duracao_min)
  if (titulo.length < 2 || titulo.length > 160) return { erro: 'Titulo deve ter entre 2 e 160 caracteres.' }
  if (genero.length < 2 || genero.length > 80) return { erro: 'Genero deve ter entre 2 e 80 caracteres.' }
  if (sinopse.length < 10 || sinopse.length > 4000) return { erro: 'Sinopse deve ter entre 10 e 4000 caracteres.' }
  if (!Number.isInteger(ano) || ano < 1895 || ano > 2100) return { erro: 'Ano invalido.' }
  if (!Number.isInteger(duracao) || duracao < 1 || duracao > 1000) return { erro: 'Duracao invalida.' }
  if (body?.capa_url && !enderecoSeguro(body.capa_url)) return { erro: 'Link da capa invalido. Use http ou https.' }
  if (body?.trailer_url && !enderecoSeguro(body.trailer_url)) return { erro: 'Link do trailer invalido. Use http ou https.' }
  return { dados: [titulo, ano, genero, duracao, sinopse, enderecoSeguro(body?.capa_url), enderecoSeguro(body?.trailer_url)] }
}

app.post('/api/filmes', autenticar, admin, async (req, res, next) => {
  try {
    const v = validarFilme(req.body)
    if (v.erro) return erro(res, 400, v.erro)
    const [result] = await db.execute('INSERT INTO filmes (titulo, ano, genero, duracao_min, sinopse, capa_url, trailer_url) VALUES (?, ?, ?, ?, ?, ?, ?)', v.dados)
    res.status(201).json({ id: result.insertId })
  } catch (e) { next(e) }
})
app.put('/api/filmes/:id', autenticar, admin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id < 1) return erro(res, 400, 'Filme invalido.')
    const v = validarFilme(req.body)
    if (v.erro) return erro(res, 400, v.erro)
    const [r] = await db.execute('UPDATE filmes SET titulo=?, ano=?, genero=?, duracao_min=?, sinopse=?, capa_url=?, trailer_url=? WHERE id=?', [...v.dados, id])
    if (!r.affectedRows) return erro(res, 404, 'Filme nao encontrado.')
    res.json({ ok: true })
  } catch (e) { next(e) }
})
app.delete('/api/filmes/:id', autenticar, admin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id < 1) return erro(res, 400, 'Filme invalido.')
    const [r] = await db.execute('DELETE FROM filmes WHERE id=?', [id])
    if (!r.affectedRows) return erro(res, 404, 'Filme nao encontrado.')
    res.json({ ok: true })
  } catch (e) { next(e) }
})

app.use('/api', (_req, res) => erro(res, 404, 'Rota nao encontrada.'))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (production) {
  app.use(express.static(path.join(root, 'dist')))
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')))
}
app.use((e, _req, res, _next) => {
  console.error('Erro da API:', e.message)
  if (e.code?.startsWith('ER_') || ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(e.code)) {
    return erro(res, 503, 'Banco MySQL indisponivel. Confira XAMPP, .env e database/schema.sql.')
  }
  return erro(res, 500, 'Erro interno no servidor.')
})

app.listen(PORT, '127.0.0.1', async () => {
  console.log(`API CineBrasil: http://127.0.0.1:${PORT}`)
  try { await db.query('SELECT 1'); console.log('MySQL conectado com sucesso!') }
  catch (e) { console.warn('MySQL ainda nao conectado:', e.code || e.message) }
})
