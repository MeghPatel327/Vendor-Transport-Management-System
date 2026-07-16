import type { VercelRequest, VercelResponse } from '@vercel/node'
import { baserowList, baserowCreate, TABLE_IDS } from '../lib/baserow'
import { requireAuth, apiResponse, apiError, allowMethods } from '../lib/helpers'

interface BaserowOrder {
  id: number
  vendor_id: number
  vendor_name?: string
  item: string
  quantity: number
  rate: number
  amount: number
  status: string
  order_date: string
}

interface BaserowVendor { id: number; name: string }

function mapOrder(row: BaserowOrder) {
  return {
    id: row.id,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    item: row.item,
    quantity: Number(row.quantity),
    rate: Number(row.rate),
    amount: Number(row.amount),
    status: (row.status as any)?.value || row.status,
    order_date: row.order_date,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (!allowMethods(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    const { search, vendor_id, status } = req.query as Record<string, string>
    const params: Record<string, string> = {}
    if (search) params['filter__item__contains'] = search
    if (vendor_id) params['filter__vendor_id__equal'] = vendor_id
    if (status) params['filter__status__equal'] = status

    const [orders, vendors] = await Promise.all([
      baserowList<BaserowOrder>(TABLE_IDS.orders, params),
      baserowList<BaserowVendor>(TABLE_IDS.vendors),
    ])
    const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v.name]))
    const result = orders.map(o => ({ ...mapOrder(o), vendor_name: vendorMap[o.vendor_id] ?? '' }))
    return apiResponse(res, result)
  }

  if (req.method === 'POST') {
    const { vendor_id, item, quantity, rate, status = 'Pending', order_date } = req.body ?? {}

    if (!vendor_id || !item || !quantity || !rate || !order_date) {
      return apiError(res, 'Missing required fields: vendor_id, item, quantity, rate, order_date', 400)
    }
    if (Number(quantity) <= 0) return apiError(res, 'Quantity must be positive', 400)
    if (Number(rate) <= 0) return apiError(res, 'Rate must be positive', 400)
    if (!['Pending', 'Received'].includes(status)) return apiError(res, 'Invalid status', 400)

    const amount = Math.round(Number(quantity) * Number(rate) * 100) / 100

    const row = await baserowCreate<BaserowOrder>(TABLE_IDS.orders, {
      vendor_id: Number(vendor_id),
      item: String(item).trim(),
      quantity: Number(quantity),
      rate: Number(rate),
      amount,
      status,
      order_date,
    })
    return apiResponse(res, mapOrder(row), 201)
  }
}
