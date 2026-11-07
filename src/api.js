import { localRequest } from './local-api.js'
export const modoLocal = import.meta.env.VITE_STATIC_MODE === 'true'
export async function requisicao(url, options = {}) {
  if (modoLocal) return localRequest(url, options)
  let response
  try {
    response = await fetch(`/api${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'same-origin',
    })
  } catch {
    throw new Error('Nao foi possivel conectar ao servidor. Execute npm.cmd run dev.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.erro || `Erro ${response.status}`)
  return data
}
