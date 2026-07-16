import type { VercelRequest, VercelResponse } from '@vercel/node'
import { baserowList, baserowCreate, TABLE_IDS } from '../lib/baserow'
import { requireAuth, apiResponse, apiError, allowMethods } from '../lib/helpers'

interface BaserowVendor {
  id: number
  name: string
  created_on: string
}

function mapVendor(row: BaserowVendor) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_on,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!allowMethods(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    const { search } = req.query as { search?: string }
    const params: Record<string, string> = {}
    if (search) params['filter__name__contains'] = search
    const rows = await baserowList<BaserowVendor>(TABLE_IDS.vendors, params)
    return apiResponse(res, rows.map(mapVendor))
  }

  if (req.method === 'POST') {
    const { name } = req.body ?? {}
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return apiError(res, 'Vendor name must be at least 2 characters', 400)
    }
    const row = await baserowCreate<BaserowVendor>(TABLE_IDS.vendors, { name: name.trim() })
    return apiResponse(res, mapVendor(row), 201)
  }
}
