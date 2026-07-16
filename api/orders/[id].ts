import type { VercelRequest, VercelResponse } from '@vercel/node'
import { baserowGet, baserowUpdate, baserowDelete, TABLE_IDS } from '../../lib/baserow'
import { requireAuth, apiResponse, apiError, allowMethods } from '../../lib/helpers'

interface BaserowOrder {
  id: number; vendor_id: number; item: string; quantity: number; rate: number;
  amount: number; status: string; order_date: string
}

function mapOrder(row: BaserowOrder) {
  return { id: row.id, vendor_id: row.vendor_id, item: row.item, quantity: Number(row.quantity), rate: Number(row.rate), amount: Number(row.amount), status: (row.status as any)?.value || row.status, order_date: row.order_date }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (!allowMethods(req, res, ['GET', 'PUT', 'DELETE'])) return

  const id = Number(req.query.id)
  if (!id || isNaN(id)) return apiError(res, 'Invalid order ID', 400)

  if (req.method === 'GET') {
    const row = await baserowGet<BaserowOrder>(TABLE_IDS.orders, id)
    return apiResponse(res, mapOrder(row))
  }

  if (req.method === 'PUT') {
    const { vendor_id, item, quantity, rate, status, order_date } = req.body ?? {}
    if (quantity !== undefined && Number(quantity) <= 0) return apiError(res, 'Quantity must be positive', 400)
    if (rate !== undefined && Number(rate) <= 0) return apiError(res, 'Rate must be positive', 400)
    if (status && !['Pending', 'Received'].includes(status)) return apiError(res, 'Invalid status', 400)

    const updates: Record<string, unknown> = {}
    if (vendor_id !== undefined) updates.vendor_id = Number(vendor_id)
    if (item !== undefined) updates.item = String(item).trim()
    if (quantity !== undefined) updates.quantity = Number(quantity)
    if (rate !== undefined) updates.rate = Number(rate)
    if (quantity !== undefined || rate !== undefined) {
      // Recalculate amount
      const existing = await baserowGet<BaserowOrder>(TABLE_IDS.orders, id)
      const q = quantity !== undefined ? Number(quantity) : existing.quantity
      const r = rate !== undefined ? Number(rate) : existing.rate
      updates.amount = Math.round(q * r * 100) / 100
    }
    if (status !== undefined) updates.status = status
    if (order_date !== undefined) updates.order_date = order_date

    const row = await baserowUpdate<BaserowOrder>(TABLE_IDS.orders, id, updates)
    return apiResponse(res, mapOrder(row))
  }

  if (req.method === 'DELETE') {
    await baserowDelete(TABLE_IDS.orders, id)
    return apiResponse(res, { deleted: true })
  }
}
