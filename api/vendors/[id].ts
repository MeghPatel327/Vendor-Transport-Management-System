import type { VercelRequest, VercelResponse } from '@vercel/node'
import { baserowGet, baserowUpdate, baserowDelete, TABLE_IDS } from '../lib/baserow'
import { requireAuth, apiResponse, apiError, allowMethods } from '../lib/helpers'

interface BaserowVendor {
  id: number
  name: string
  created_on: string
}

function mapVendor(row: BaserowVendor) {
  return { id: row.id, name: row.name, created_at: row.created_on }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!allowMethods(req, res, ['GET', 'PUT', 'DELETE'])) return

  const id = Number(req.query.id)
  if (!id || isNaN(id)) return apiError(res, 'Invalid vendor ID', 400)

  if (req.method === 'GET') {
    const row = await baserowGet<BaserowVendor>(TABLE_IDS.vendors, id)
    return apiResponse(res, mapVendor(row))
  }

  if (req.method === 'PUT') {
    const { name } = req.body ?? {}
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return apiError(res, 'Vendor name must be at least 2 characters', 400)
    }
    const row = await baserowUpdate<BaserowVendor>(TABLE_IDS.vendors, id, { name: name.trim() })
    return apiResponse(res, mapVendor(row))
  }

  if (req.method === 'DELETE') {
    await baserowDelete(TABLE_IDS.vendors, id)
    return apiResponse(res, { deleted: true })
  }
}
