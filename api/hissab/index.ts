import type { VercelRequest, VercelResponse } from '@vercel/node'
import { baserowList, TABLE_IDS } from '../../lib/baserow'
import { requireAuth, apiResponse, allowMethods } from '../../lib/helpers'

interface BaserowTransport {
  id: number; vendor_id: number; lr_number: string; city: string; item: string;
  dispatched_quantity: number; rate: number; payment_status: string; transport_date: string
}
interface BaserowVendor { id: number; name: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (!allowMethods(req, res, ['GET'])) return

  const { vendor_id, city } = req.query as Record<string, string>
  const params: Record<string, string> = {}
  if (vendor_id) params['filter__vendor_id__equal'] = vendor_id
  if (city) params['filter__city__equal'] = city

  const [transport, vendors] = await Promise.all([
    baserowList<BaserowTransport>(TABLE_IDS.transport, params),
    baserowList<BaserowVendor>(TABLE_IDS.vendors),
  ])
  const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v.name]))

  const entries = transport.map(t => {
    const dispatchedQty = Number(t.dispatched_quantity)
    const rate = Number(t.rate)
    const hissab_amount = Math.round(dispatchedQty * rate * 100) / 100
    return {
      transport_id: t.id,
      vendor_id: t.vendor_id,
      vendor_name: vendorMap[t.vendor_id] ?? '',
      city: t.city,
      item: t.item,
      lr_number: t.lr_number,
      dispatched_quantity: dispatchedQty,
      rate,
      hissab_amount,
      transport_date: t.transport_date,
      payment_status: t.payment_status,
    }
  })

  const total_hissab_amount = Math.round(entries.reduce((s, e) => s + e.hissab_amount, 0) * 100) / 100
  const total_dispatched_quantity = entries.reduce((s, e) => s + e.dispatched_quantity, 0)

  return apiResponse(res, { entries, total_hissab_amount, total_dispatched_quantity })
}
