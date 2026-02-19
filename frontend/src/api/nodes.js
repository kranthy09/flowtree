const API = '/api/nodes'

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const fetchNodes = () =>
  request(API)

export const createNode = (data) =>
  request(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const updateNode = (id, data) =>
  request(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const deleteNode = (id) =>
  request(`${API}/${id}`, { method: 'DELETE' })
