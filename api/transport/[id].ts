import type { VercelRequest, VercelResponse } from '@vercel/node'
import { baserowGet, baserowUpdate, baserowDelete, TABLE_IDS } from '../lib/baserow'
import { requireAuth, apiResponse, apiError, allowMethods } from '../lib/helpers'

interface BaserowTransport {
  id: number; vendor_id: number; lr_number: string; transport_name: string; city: string;
  item: string; quantity: number; dispatched_quantity: number; remaining_quantity: number;
  rate: number; amount: number; payment_status: string; transport_date: string
}

function mapTransport(row: BaserowTransport) {
  return {
    id: row.id, vendor_id: row.vendor_id, lr_number: row.lr_number,
    transport_name: row.transport_name, city: row.city, item: row.item,
    quantity: Number(row.quantity), dispatched_quantity: Number(row.dispatched_quantity),
    remaining_quantity: Number(row.remaining_quantity), rate: Number(row.rate),
    amount: Number(row.amount), payment_status: (row.payment_status as any)?.value || row.payment_status, transport_date: row.transport_date,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (!allowMethods(req, res, ['GET', 'PUT', 'DELETE'])) return

  const id = Number(req.query.id)
  if (!id || isNaN(id)) return apiError(res, 'Invalid transport ID', 400)

  if (req.method === 'GET') {
    const row = await baserowGet<BaserowTransport>(TABLE_IDS.transport, id)
    return apiResponse(res, mapTransport(row))
  }

  if (req.method === 'PUT') {
    const body = req.body ?? {}
    const existing = await baserowGet<BaserowTransport>(TABLE_IDS.transport, id)

    const qty = body.quantity !== undefined ? Number(body.quantity) : Number(existing.quantity)
    const dispatched = body.dispatched_quantity !== undefined ? Number(body.dispatched_quantity) : Number(existing.dispatched_quantity)
    const rate = body.rate !== undefined ? Number(body.rate) : Number(existing.rate)

    if (qty <= 0) return apiError(res, 'Quantity must be positive', 400)
    if (rate <= 0) return apiError(res, 'Rate must be positive', 400)
    if (dispatched < 0) return apiError(res, 'Dispatched quantity cannot be negative', 400)
    if (dispatched > qty) return apiError(res, 'Dispatched quantity cannot exceed total quantity', 400)

    const remaining = Math.max(0, qty - dispatched)
    const amount = Math.round(qty * rate * 100) / 100

    const updates: Record<string, unknown> = {
      quantity: qty, dispatched_quantity: dispatched, remaining_quantity: remaining, rate, amount,
    }
    if (body.vendor_id !== undefined) updates.vendor_id = Number(body.vendor_id)
    if (body.lr_number !== undefined) updates.lr_number = String(body.lr_number).trim()
    if (body.transport_name !== undefined) updates.transport_name = String(body.transport_name).trim()
    if (body.city !== undefined) updates.city = String(body.city).trim()
    if (body.item !== undefined) updates.item = String(body.item).trim()
    if (body.payment_status !== undefined) {
      if (!['Pending', 'Paid', 'Partial'].includes(body.payment_status)) return apiError(res, 'Invalid payment_status', 400)
      updates.payment_status = body.payment_status
    }
    if (body.transport_date !== undefined) updates.transport_date = body.transport_date

    const row = await baserowUpdate<BaserowTransport>(TABLE_IDS.transport, id, updates)
    return apiResponse(res, mapTransport(row))
  }

  if (req.method === 'DELETE') {
    await baserowDelete(TABLE_IDS.transport, id)
    return apiResponse(res, { deleted: true })
  }
}
