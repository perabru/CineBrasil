// GitHub Pages: dados pessoais somente neste navegador, sem autenticação remota.
const KEY = 'cinebrasil-pages-v1'
const initial = [
  ['Central do Brasil',1998,'Drama',113,'Uma escritora de cartas acompanha um menino em uma viagem pelo Brasil.'],
  ['O Auto da Compadecida',2000,'Comédia',104,'João Grilo e Chicó vivem de esperteza no sertão nordestino.'],
  ['Cidade de Deus',2002,'Drama',130,'Um jovem fotógrafo registra a comunidade onde cresceu, no Rio de Janeiro.'],
  ['Que Horas Ela Volta?',2015,'Drama',112,'A chegada da filha de uma trabalhadora doméstica transforma as relações em uma casa de São Paulo.']
].map(([titulo,ano,genero,duracao_min,sinopse],i)=>({id:i+1,titulo,ano,genero,duracao_min,sinopse,capa_url:'',trailer_url:''}))
function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {filmes:initial,usuario:null,ids:[]} }
  catch { throw new Error('Não foi possível ler os dados locais. Verifique o armazenamento do navegador.') }
}
function save(data) {
  try { localStorage.setItem(KEY,JSON.stringify(data)) }
  catch { throw new Error('Não foi possível salvar neste navegador. Verifique o espaço e as permissões de armazenamento.') }
}
export async function localRequest(url, options={}) {
  const data=read(), method=options.method || 'GET'
  const body=JSON.parse(options.body || '{}')
  if(url==='/auth/me') return {usuario:data.usuario}
  if(url==='/auth/cadastro' || url==='/auth/login') {
    const nome=String(body.nome||'').trim()
    if(!nome) throw new Error('Informe um nome para o perfil local.')
    data.usuario={id:1,nome,papel:'admin'};save(data);return {usuario:data.usuario}
  }
  if(url==='/auth/logout') {data.usuario=null;save(data);return {ok:true}}
  if(url==='/filmes' && method==='GET') return {filmes:data.filmes}
  if(url==='/favoritos' && method==='GET') return {ids:data.ids}
  if(!data.usuario) throw new Error('Abra seu perfil local primeiro.')
  const id=Number(url.split('/')[2])
  if(url.startsWith('/favoritos/')) {
    if(!data.filmes.some(f=>f.id===id)) throw new Error('Filme não encontrado.')
    data.ids=method==='DELETE'?data.ids.filter(n=>n!==id):[...new Set([...data.ids,id])]
  } else if(url.startsWith('/filmes')) {
    if(method==='DELETE') {data.filmes=data.filmes.filter(f=>f.id!==id);data.ids=data.ids.filter(n=>n!==id)}
    else {
      for(const field of ['capa_url','trailer_url']) {
        if(body[field] && !/^https?:\/\//i.test(body[field])) throw new Error('Use links http ou https nas imagens e trailers.')
      }
      if(!body.titulo?.trim() || !body.genero?.trim() || !body.sinopse?.trim() || !Number.isInteger(body.ano) || body.ano<1888 || !Number.isInteger(body.duracao_min) || body.duracao_min<1) throw new Error('Preencha os dados do filme corretamente.')
      if(method==='PUT') {
        const index=data.filmes.findIndex(f=>f.id===id)
        if(index<0) throw new Error('Filme não encontrado.')
        data.filmes[index]={...body,id}
      } else data.filmes.push({...body,id:Math.max(0,...data.filmes.map(f=>f.id))+1})
    }
  } else throw new Error('Operação não disponível.')
  save(data);return {ok:true}
}
