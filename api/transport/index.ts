import type { VercelRequest, VercelResponse } from '@vercel/node'
import { baserowList, baserowCreate, TABLE_IDS } from '../../lib/baserow'
import { requireAuth, apiResponse, apiError, allowMethods } from '../../lib/helpers'

interface BaserowTransport {
  id: number; vendor_id: number; lr_number: string; transport_name: string; city: string;
  item: string; quantity: number; dispatched_quantity: number; remaining_quantity: number;
  rate: number; amount: number; payment_status: string; transport_date: string
}
interface BaserowVendor { id: number; name: string }

function mapTransport(row: BaserowTransport, vendorName?: string) {
  return {
    id: row.id, vendor_id: row.vendor_id, vendor_name: vendorName ?? '',
    lr_number: row.lr_number, transport_name: row.transport_name, city: row.city, item: row.item,
    quantity: Number(row.quantity), dispatched_quantity: Number(row.dispatched_quantity),
    remaining_quantity: Number(row.remaining_quantity), rate: Number(row.rate),
    amount: Number(row.amount), payment_status: (row.payment_status as any)?.value || row.payment_status, transport_date: row.transport_date,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (!allowMethods(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    const { search, vendor_id, payment_status, city } = req.query as Record<string, string>
    const params: Record<string, string> = {}
    if (search) params['filter__lr_number__contains'] = search
    if (vendor_id) params['filter__vendor_id__equal'] = vendor_id
    if (payment_status) params['filter__payment_status__equal'] = payment_status
    if (city) params['filter__city__equal'] = city

    const [transport, vendors] = await Promise.all([
      baserowList<BaserowTransport>(TABLE_IDS.transport, params),
      baserowList<BaserowVendor>(TABLE_IDS.vendors),
    ])
    const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v.name]))
    const result = transport.map(t => mapTransport(t, vendorMap[t.vendor_id]))
    return apiResponse(res, result)
  }

  if (req.method === 'POST') {
    const { vendor_id, lr_number, transport_name, city, item, quantity, dispatched_quantity = 0, rate, payment_status = 'Pending', transport_date } = req.body ?? {}

    if (!vendor_id || !lr_number || !transport_name || !city || !item || !quantity || !rate || !transport_date) {
      return apiError(res, 'Missing required fields', 400)
    }
    const qty = Number(quantity)
    const dispatched = Number(dispatched_quantity)
    const r = Number(rate)

    if (qty <= 0) return apiError(res, 'Quantity must be positive', 400)
    if (r <= 0) return apiError(res, 'Rate must be positive', 400)
    if (dispatched < 0) return apiError(res, 'Dispatched quantity cannot be negative', 400)
    if (dispatched > qty) return apiError(res, 'Dispatched quantity cannot exceed total quantity', 400)
    if (!['Pending', 'Paid', 'Partial'].includes(payment_status)) return apiError(res, 'Invalid payment_status', 400)

    const remaining = Math.max(0, qty - dispatched)
    const amount = Math.round(qty * r * 100) / 100

    const row = await baserowCreate<BaserowTransport>(TABLE_IDS.transport, {
      vendor_id: Number(vendor_id), lr_number: String(lr_number).trim(),
      transport_name: String(transport_name).trim(), city: String(city).trim(),
      item: String(item).trim(), quantity: qty, dispatched_quantity: dispatched,
      remaining_quantity: remaining, rate: r, amount, payment_status, transport_date,
    })
    return apiResponse(res, mapTransport(row), 201)
  }
}
