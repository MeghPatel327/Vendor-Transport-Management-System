// Baserow API utility — used only by serverless functions (server-side only)
const BASEROW_API_URL = process.env.BASEROW_API_URL || 'https://api.baserow.io'
const BASEROW_TOKEN = process.env.BASEROW_TOKEN || ''

export const TABLE_IDS = {
  vendors: Number(process.env.BASEROW_VENDORS_TABLE_ID),
  orders: Number(process.env.BASEROW_ORDERS_TABLE_ID),
  transport: Number(process.env.BASEROW_TRANSPORT_TABLE_ID),
}

interface BaserowListResponse<T> {
  count: number
  results: T[]
}

function baserowHeaders() {
  return {
    Authorization: `Token ${BASEROW_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function baserowList<T>(
  tableId: number,
  params?: Record<string, string | number | boolean>
): Promise<T[]> {
  const url = new URL(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/`)
  url.searchParams.set('user_field_names', 'true')
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    }
  }
  const res = await fetch(url.toString(), { headers: baserowHeaders() })
  if (!res.ok) throw new Error(`Baserow list error: ${res.status}`)
  const data: BaserowListResponse<T> = await res.json()
  return data.results
}

export async function baserowGet<T>(tableId: number, rowId: number): Promise<T> {
  const url = `${BASEROW_API_URL}/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`
  const res = await fetch(url, { headers: baserowHeaders() })
  if (!res.ok) throw new Error(`Baserow get error: ${res.status}`)
  return res.json()
}

export async function baserowCreate<T>(tableId: number, body: Record<string, unknown>): Promise<T> {
  const url = `${BASEROW_API_URL}/api/database/rows/table/${tableId}/?user_field_names=true`
  const res = await fetch(url, { method: 'POST', headers: baserowHeaders(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Baserow create error: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function baserowUpdate<T>(tableId: number, rowId: number, body: Record<string, unknown>): Promise<T> {
  const url = `${BASEROW_API_URL}/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`
  const res = await fetch(url, { method: 'PATCH', headers: baserowHeaders(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Baserow update error: ${res.status}`)
  return res.json()
}

export async function baserowDelete(tableId: number, rowId: number): Promise<void> {
  const url = `${BASEROW_API_URL}/api/database/rows/table/${tableId}/${rowId}/`
  const res = await fetch(url, { method: 'DELETE', headers: baserowHeaders() })
  if (!res.ok) throw new Error(`Baserow delete error: ${res.status}`)
}
